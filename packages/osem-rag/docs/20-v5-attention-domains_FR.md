# 20 — ARIANE-CHAMP v5 : domaines d'attention, ownership, cache épisodique de requêtes

> Statut : design convergé, en attente de décision. S'appuie sur le doc 19 (physique v4).
> Motivation : un défaut vérifié par probe — des horloges tick divergentes par agent
> corrompent le sédiment global (exposant négatif → inflation exponentielle de la
> salience, rembobinage d'horloge). v5 le résout par partition, pas par patch, et
> généralise le modèle de scopes en architecture uniforme de domaines d'attention.

---

## 1. Le changement central — chaque scope EST un domaine d'attention

v4 traite `tick` comme un scalaire fourni par l'appelant, écrit dans des champs
LTP globaux (`atoms.salience/tau/uses_spaced/touched_tick`). Deux agents sur des
timelines différentes corrompent cet état partagé.

v5 lève l'ambiguïté entièrement : **un scope est un plan de mémoire avec sa
propre horloge d'attention, son propre sédiment, son propre log de
consultation**. Aucun champ n'est jamais écrit par deux horloges différentes.

```
domain(scope) = scope          — le mapping est l'identité, aucun cas particulier
```

`public` est simplement le plan partagé dont l'owner est le système. Le
consulter revient à interroger l'agent collectif ; son horloge avance quand
l'attention collective y atterrit — peu importe qui a demandé.

## 2. Définitions

| Symbole | Signification |
|---|---|
| `s` | un scope : `agent:X` \| `public` \| `scope:*` \| `skill:*` |
| `owner(s)` | `owner(agent:X) = X` (auto-possédé) ; `owner(scope:*)` = son agent owner ; `owner(public)` = system |
| `tick_s` | compteur d'attention propre au scope, démarre à 0 |
| `σ(a, s)` | sédiment de l'atome `a` sous le domaine `s` : `(salience, τ, uses_spaced, touched_tick)` |
| `L_s` | log de consultation borné de `s` (X dernières entrées) : `(requester, prompt, surfaces, tick_s)` |
| `P_s` | vérités épinglées de `s` — certifiées par l'owner |

## 3. La requête adressée

`recall(X, q, scopes = [s₁..sₙ])` **transmet** `q` à chaque domaine `sᵢ` — c'est
une requête déléguée, pas une lecture de table :

```
∀ sᵢ : wave(q, sᵢ) → commit(sᵢ)
   si surfaces retenues (> seuils) :
      tick_{sᵢ}++                             — l'attention fait avancer le temps
      L_{sᵢ} += (X, q, surfaces, tick_{sᵢ})   — attribution
      ∀ a surfacé : mise à jour de σ(a, sᵢ) sur l'horloge de sᵢ
   sinon : silence honnête → rien ne bouge
```

- **Attribution** : le log de requête `L_s` du scope consulté enregistre *qui
  a demandé quoi* — l'attention collective devient responsable. Note : c'est
  un log de requêtes, pas un log d'accès — le moteur sait qui a demandé,
  jamais qui a *vu* (surfacé ≠ injecté ≠ lu ; ce que le caller fait de la
  sortie est hors de portée du moteur).
- **Gouvernance de lecture** : l'owner peut gater la consultation — `scopes`
  devient une ACL (délégable/révocable), pas juste un filtre.
- L'horloge du demandeur n'avance que s'il commit dans son propre plan.

### Surfacé est un état interne, pas un audit trail

`surface_log` reste de l'instrumentation physique pure — ses seuls
consommateurs sont la fatigue nodale (surface_count des parents dans la
fenêtre) et l'apprentissage `resonates` (co-surfacés sur ≥2 ticks). Elle
enregistre *quels atomes ont chauffé dans quel plan*, jamais *qui a accédé à
quoi*. Si la gouvernance veut un audit trail (« qui a demandé quoi »), il
vit dans le log de requêtes rotatif séparé `L_s` — et « qui a vu quoi »
reste une responsabilité applicative, hors du moteur.

## 4. Horloges conditionnées par l'attention

`tick_s` n'avance **que sur commit au-dessus des seuils** dans `s` — un tick est
un événement d'attention, pas un événement de requête. Le silence honnête ne
vieillit rien : poser des questions sans réponse n'érode pas la mémoire. Le
compteur est dérivable de l'état (nombre de commits par domaine) → déterminisme
préservé.

Le paramètre `tick` sort de l'API publique : `recall({ agentId, prompt })`.
Le tick explicite ne survit qu'en override debug/replay.

## 5. La physique de la hype, par domaine

À chaque hit de `a` dans le domaine `s`, avec `Δt = tick_s − touched_tick(a,s)`
(clampé `Δt ≥ 0`) :

```
salience'    = max( salience · 2^(−Δt/τ),  λ_LTP · E )
τ'           = min( τ · (1 + κτ·min(1, Δt/τ)),  τ_cap ),   τ_cap = τ₀(1+κτ)^U
uses_spaced' = uses_spaced + [Δt ≥ τ/2]
touched_tick' = tick_s                     — monotone, jamais rembobiné
```

Salience effective dans le scoring :

```
S_eff(a, s) = max( salience·2^(−Δt/τ),  F_max·(1 − e^(−Us/λf)),  F_flag )
```

Le facteur de contraction `2^(−Δt/τ) · boost · λ_LTP ≤ 0.12 < 1` borne la boucle
de feedback — **inconditionnellement**, puisque Δt ne peut plus être négatif.

Échelle de permanence :

```
pinned       → permanent tant que la vérité vit (plateau autoritaire)
floor gagné  → F_max·(1 − e^(−Us/λf)), asymptotique, mérité par le spacing
decay        → hype vivante
inerte       → 0 fonctionnel (re-seedable)
superseded   → mort déclarée
```

## 6. Trois strates par scope

| Strate | Clé | Gouvernance |
|---|---|---|
| Vérités | atomes déposés dans `s` | hype : decay / spacing / floor |
| Log de requêtes | `L_s` rotatif (X derniers) | qui a demandé quoi — attribution |
| Traces du champ | `surface_log` (interne) | fatigue + resonates uniquement |
| Vérités confirmées | `P_s` | **owner uniquement**, hors decay |

## 7. Les pins sont des références vivantes

Un pin pointe une *identité de vérité*, pas un fait figé. `injectContext`
résout chaque pin à travers la chaîne de supersession vers la version
**active** courante :

- vérité mise à jour (v1→v2→v3) → le pin suit ;
- vérité rétractée sans successeur → le pin meurt (ou flag *stale*).

Un pin sur un savoir rétracté est un mensonge persistant — pire que l'absence
de pin. L'autorité est contextuelle : confirmer dans `scope:proj` n'épingle
pas pour `agent:X`.

## 8. Le cache épisodique de requêtes (plan privé)

Après une recherche fructueuse, l'agent dépose dans son propre plan :

```
deposit(agent:X, atom_query = q)  +  liens (supports / derives_from) → top-N résultats
```

Le query-atom est du contenu interrogeable. **La mémoire de la requête ne vit
que du côté du demandeur** : le scope consulté ne dépose PAS la requête reçue —
il n'ajoute qu'une entrée `L_s` (log rotatif, pas un atome). Sinon la même
requête impacterait les atomes deux fois : une fois via le commit de la vague
sur le domaine consulté, une fois via la propagation du query-atom déposé.
Une requête = un impact par atome.

Une requête similaire ultérieure le matche en premier ; la propagation
transporte l'énergie vers les atomes réels :

```
e_réel ≈ e_query · w_lien / √(1 + β_din · din)
```

Avec `w_supports = 0.6` et `din = 1` (lien unique) : **~60% du hit atteint
l'atome réel** — proche de `thetaConf`. Un atome populaire (`din` élevé) dilue
la contribution du bookmark, à juste titre : le contenu célèbre ne doit pas
être dominé par le cache d'un seul agent.

Le plan privé devient un **index personnel appris** du savoir partagé — chaque
agent construit son propre PageRank sur le corpus collectif, pondéré par son
propre historique d'attention, avec zéro duplication de contenu.

## 9. Sémantique du hit de cache

Quand le bookmark est hitté et que la propagation fait surfacer l'atome réel,
le commit a lieu dans le plan du demandeur :

```
σ(atome_réel, agent:X)  += hit      — la familiarité de X grandit
σ(atome_réel, public)   inchangé    — public n'a jamais été consulté
```

**Règle** : le sédiment s'écrit dans le domaine où le commit a eu lieu. Un hit
de cache est une affaire privée entre l'agent, ses bookmarks et le graphe ;
`tick_s` n'avance que sur requête réellement transmise à `s`.

Auto-réparation : si les cibles du bookmark ont été superseded entre-temps, la
propagation atteint des inertes → le trou est détecté → l'agent retransmet à
`public` → l'horloge publique ticke alors, légitimement.

## 10. Matrice ACL

| Action | Qui | Effet horloge |
|---|---|---|
| `recall` | tout agent sur scopes accessibles | ticke les scopes commités |
| `deposit` | owner dans `agent:X` (libre) ; scopes avec droit d'écriture | — |
| `pin` | `owner(s)` dans `s` uniquement | — |
| `tick` | interne, par scope, attention-gated | sorti de l'API publique |

Les miroirs ne survivent que pour le broadcast délibéré ; le cache personnel
passe par les bookmarks. L'isolation d'écriture est absolue : un agent n'écrit
jamais hors de son propre plan.

## 11. Surface d'API

```ts
recall({ agentId, prompt, mode?: "terms" })   // cascade par défaut
deposit(...)   ingestDocs(...)   injectContext(...)
maintain()     topAtoms()        stats()
confirm(atom, scope)                          // pin — owner only
```

## 12. Migration depuis v4

- `atoms.salience/tau/uses_spaced/touched_tick` → `atom_sediment(atom_id, scope_id, ...)`.
- La requête `hot` joint le sédiment sur le domaine du scope committant.
- `surface_log` inchangé (instrumentation interne) ; nouvelle table rotative `consultation_log(scope_id, requester, prompt, tick)` pour `L_s`.
- `agent_energy` inchangé (déjà par scope) — STP/LTP partagent désormais la même clé.
- `IExciteInput.tick` → compteurs internes par scope.
- Les miroirs `share` gardent énergie+trace (`learn=false`) ; le cache personnel passe aux bookmarks.

## 13. Invariants

- **I1** : `tick_s` n'avance que sur commits au-dessus des seuils dans `s`.
- **I2** : deux domaines n'écrivent jamais la même ligne de sédiment — `σ` est clavé `(atom, scope)`.
- **I3** : `touched_tick(a,s)` est monotone non décroissant dans son domaine.
- **I4** : les pins ne résolvent que vers des atomes actifs (via supersession) ; un pin sans successeur vivant meurt ou flag stale.
- **I5** : `confirm` exige `owner(scope)` ; aucun autre rôle ne peut pinner.
- **I6** : un agent n'écrit jamais hors de son propre plan (sauf scopes à droit d'écriture explicite) ; la visibilité croisée vient des lectures, pas des miroirs.
- **I7** : le silence honnête ne commit rien, ne log rien, ne ticke rien.
- **I8** : `surface_log` n'est jamais un journal d'accès/audit — l'état surfacé est interne ; l'attribution vit uniquement dans `L_s`, et « qui a vu » n'est jamais enregistré par le moteur.
- **I9** : une requête impacte chaque atome exactement une fois — le scope consulté n'enregistre la requête que dans `L_s` ; le query-atom n'est déposé que dans le plan du demandeur, lié `supports`/`derives_from` aux résultats.

## 14. Addendum — directions expérimentales (POC requis avant décision)

### 14a. Automate sensibilité/viralité — étudié, rejeté (production validée)

Une famille de récurrences discrètes a été simulée (`sandbox/sim-automaton*.mjs`,
`sim-poc.mjs`) : impulsion additive, pente de convergence `s(A)`, canal viral
logistique `K·(y+P)(1−(y+P)/L)` gaté par `P>0`, et quatre lectures d'érosion
(drain littéral, amortissement de taux, `d·max(0,y−P)`, `d·(y−P)`).

Verdict par élimination — la production `max(σ·2^(−Δt/τ), λ·e)` est confirmée :

- l'impulsion additive pompe sous spam (×5) ; le `max` est l'anti-hype structurel ;
- la viralité non gatée avec `K>d` crée un attracteur universel `L(1−d/K)` —
  l'oubli est aboli ; `K<d` est obligatoire pour une érosion inconditionnelle ;
- `y+P > L` est létal en saturation — exigerait `L ≥ 1+H` ou un clamp ;
- l'effet plateau porté (`y* ≈ P` tant que le voisinage alimente) est réel
  mais faible et déjà approximé par le floor `uses_spaced` existant ;
- coût : +2 constantes, bornes de régime, pour un gain opérationnel marginal
  → mis de côté.

Sémantique conservée : `P` (énergie propagée) est de la **pure modulation**
(sensibilisation), jamais une écriture directe — cohérent avec GATE ci-dessous.

### 14b. LTP conditionné par l'injection — la consolidation suit l'usage réel

Infléchissement à l'étude : le STP (`agent_energy`) s'écrit à la surface/commit,
mais le LTP (salience, uses_spaced, τ, floor) ne s'écrirait que pour les atomes
réellement **injectés** dans le contexte — la consolidation récompenserait la
livraison, pas la simple activation.

Résultats du POC sandbox (`sandbox/sim-poc.mjs`, corpus clusterisé 40 atomes,
sweep paramétrique) : le LTP fantôme de l'écriture au commit est réel — jusqu'à
**36% du crédit de consolidation** part à des bystanders jamais injectés à
budget serré (PAYLOAD=3), ~10% à baseline, et croît inversement au budget
d'injection. Le gating élimine le LTP fantôme par construction avec **zéro coût
sur les ancres** (floors identiques pour les parents injectés en breadcrumbs).
L'effet se concentre dans les graphes modérément connectés où la propagation
commit des bystanders sans les diluer sous `thetaTop`.

Points ouverts : les breadcrumbs comptent comme contexte livré (crédit pondéré
par rôle ?) ; exige que le caller appelle `injectContext` pour que la mémoire
apprenne (modèle possible à deux compteurs : tick sur commit pour le STP,
crédit espacé sur injection pour le LTP).

GATE est la seule direction portée en candidat POC réel — mesurable sur
`poc-ariane-champ-v12`. Le cœur du modèle v5 (domaines d'attention, sédiment
par scope, pins, bookmarks) n'en dépend pas.

## 15. Points ouverts

- Borne rotative X de `L_s` et sémantique d'éviction (FIFO).
- Pin dans `public` : owner unique vs quorum.
- Sémantique du tick miroir pour le broadcast délibéré (un share commité ticke-t-il le plan cible ? proposition : oui — c'est de l'attention atterrie sur ce plan).
- L'apprentissage `resonates` sous sédiment par domaine.
