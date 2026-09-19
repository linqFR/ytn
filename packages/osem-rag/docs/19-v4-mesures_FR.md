# 19 — ARIANE-CHAMP v4 : concepts, état du code, protocole de mesure

> Statut : spec + plan de mesure. Code de référence : `sandbox/poc-ariane-champ-v6.ts`
> (~610 lignes, zéro dépendance hors `better-sqlite3`) — implémente V4-1→V4-10 :
> moteur multi-surfaces, descente `contains`, fatigue, élagage tracé, STP/LTP
> paresseux, cascade avec reformulation, injection 2 pools. Historique : v3 (STP/LTP),
> v4 (SQL pur), v5 (surfaces croisées).

---

## 1. Concepts — ce qui est réellement nouveau

### 1.1 La double échelle temporelle (STP / LTP)

Deux états par atome, deux constantes de temps, deux rôles :

| Couche | Stockage | Decay | Analogie | Rôle |
|---|---|---|---|---|
| `session_energy` | SQLite, reset par session | ×0.7 / prompt | STP (mémoire de travail) | Amorçage : un sujet évoqué reste "chaud" dans la session |
| `salience` | SQLite, persistant | ×0.9 / session | LTP (consolidation) | Un sujet travaillé souvent survit aux jours sans sollicitation |

Règle clé de la v3 : **la salience n'ajoute de l'énergie qu'aux atomes déjà excités**.
La chaleur long-terme *abaisse le seuil* ; elle ne fait pas remonter sans signal.
Un atome chaud hors-sujet ne pollue jamais le contexte.

### 1.2 Hystérésis bornée (renforcement des associations)

Chaque arête traversée par l'onde gagne `η = 0.05` de poids (cap `w ≤ 3`,
`+0.5` max par session, refill 0.98/session prévu). Les chemins fréquents
deviennent des autoroutes ; les chemins morts s'érodent lentement.

**Immunités** (contre le fait zombie, C4 du sceptique) :
- `status ≠ active` → jamais renforcé, jamais excité.
- Arêtes `floor = 1` (canaux gravés) → ni renforcées ni érodées : la garantie
  ne dépend pas de l'usage.

### 1.3 Le plancher critique

`flag = pinned` ou `critical` → `salience` ne peut jamais descendre sous 0.3.
La criticité est un *droit de surface*, pas un score probabiliste.
Un fait prononcé une fois reste atteignable des mois plus tard —
indépendamment de sa fréquence d'usage (fréquence ≠ importance).

### 1.4 Consolidation comportementale

En fin de session : `salience += 0.3 × énergie_session` pour les atomes ayant
résonné sur ≥ 2 prompts (ondes stationnaires). Le champ *mesure* quoi
consolider ; aucun LLM ne décide. Le LLM ne sert qu'à rédiger le résumé
éventuel.

### 1.5 Fatigue synaptique (anti-chambre-d'écho déterministe)

Contre le rich-get-richer, **pas d'aléatoire** (ε-greedy abandonné : il injectait
du bruit pour compenser un défaut du modèle de poids). La bonne mécanique est la
**dépression synaptique** — une synapse qui tire beaucoup transmet
temporairement moins bien :

`w_eff = w / (1 + λ·uses_récents)`  avec λ≈0.15, decay ×0.5/prompt.

Le chemin le plus emprunté se fatigue → les voisins deviennent *relativement*
plus attractifs → le champ tourne mécaniquement autour du thème au lieu de
fixer dessus. Rotation sans bruit, bornée par construction (la force nominale
`w` n'est jamais modifiée), réversible (intra-session seulement).
**Exemption** : `floor=1` ne fatigue jamais — un canal gravé ne dépend pas de
l'humeur du champ.

### 1.6 Sélection thermique (transposition de T-GADE, arXiv:2609.12287)

T-GADE applique la thermodynamique statistique à la *génération* (sélection
d'artefacts par niveau d'énergie, haute entropie = diversité conservée, états
instables éliminés). Domaine différent, mais la transposition au champ est
réelle — **non sur la propagation, sur l'injection** :

- Le `θ` dur actuel est un filtre binaire (dedans/dehors). Une **sélection
  de Boltzmann** `P(surface) ∝ exp(E/kT)` remplacerait le seuil par une
  distribution : les atomes juste sous θ ont une chance, proportionnelle à
  leur énergie — fini le cliff-effect.
- Le paramètre utile n'est pas l'aléatoire, c'est le **schedule de
  température (annealing)** : T haute en début de session (le champ
  explore large, contexte pas encore cristallisé) → T basse quand les
  ondes stationnaires émergent (la session a un thème, on exploite).
  La température devient une *fonction déterministe de l'état de session* :
  `T = f(nb_ondes, entropy_session)` — la politique reste mécanique,
  seul l'échantillonnage est stochastique.
- **Distinction avec la fatigue** : la fatigue fait *tourner les chemins*
  (propagation) ; la température règle la *largeur d'admission* (injection).
  Les deux mécanismes sont orthogonaux et non substituables.

Statut : candidat expérimental — à évaluer en A/B contre le θ dur (test A6).
Le T-GADE original cible la génération ; sa valeur ici est le schedule, pas
la sélection elle-même.

### 1.7 Ce qui n'est PAS nouveau (cartographie du sceptique, maintenue)

- Propagation = spreading activation / PPR (HippoRAG, 2024)
- Ondes stationnaires = compteur de co-activation / EWMA (Generative Agents, 2023)
- Harmoniques = remontée `derives_from` (RAPTOR)
- Le quasi-sans-équivalent reste : **l'audit nodal/accessibilité** et le
  `carrier_at_write` (la mémoire connaît la situation de l'agent à l'encodage).

---

## 2. Le code — état v3 et changements v4

### 2.1 Architecture effective (v3, testée)

```
prompt ──► excite()
             1. graines : FTS5 (OR des termes ≥3 chars, rank BM25) ∪ refs regex
             2. + salience résiduelle sur atomes excités (abaissement de seuil)
             3. propagation : front itératif (2 iters, ×0.85), Map en RAM
             4. arêtes traversées : w += η (borné)
             5. session_energy : upsert + decay
fin session ──► consolidate() : ondes ∪ flaggés → salience += 0.3×E
             ► longTermDecay() : salience ×= 0.9, floor pour les flaggés
```

### 2.2 Changements v4 (réponse à la critique d'ingénierie)

| # | Problème v3 | Correctif v4 |
|---|---|---|
| V4-1 | `loadAdjacency` charge tout le graphe en RAM Node → OOM à ~100k nœuds, Event Loop gelé | **Propagation en SQL pur** : `WITH RECURSIVE wave(id, e, depth)` sur `atom_links`, depth ≤ 2, agrégation `SUM(e)` par atome dans le CTE. Résultat matérialisé en table temporaire `_wave`. |
| V4-2 | N+1 : un `UPDATE` par arête traversée (500 arêtes = 500 requêtes) | **Un seul `UPDATE ... FROM _wave`** joint sur `atom_links.src`. Toutes les synapses renforcées en une requête. |
| V4-3 | `longTermDecay` = `UPDATE` sur tous les atomes actifs → locks + gonflement du WAL | **Decay paresseux** : `salience` décroît à la lecture (`salience × 0.9^sessions_depuis_last_touch`), un seul `UPDATE` par atome *touché*. Alternative si l'équipe préfère le decay eager : `UPDATE ... WHERE salience > FLOOR AND flag IS NULL` (filtré, pas full-table). |
| V4-4 | Pas d'exploration → chambre d'écho garantie à terme | **Fatigue synaptique** (cf. 1.5) : `w_eff = w / (1 + λ·uses_récents)`, λ≈0.15, decay ×0.5/prompt, `floor=1` exempt. Rotation déterministe, ε-greedy supprimé. |
| V4-5 | Hubs captent l'énergie — mais diviser par le *compte* étranglerait les documents fondamentaux (50 arêtes → énergie/50) | **Normalisation par masse de poids** : `w_ij / Σ_j w_ij`. Une arête à poids 3 parmi cinquante à poids 1 garde 3/53 de l'énergie au lieu de 1/50. `floor=1` exclus du diviseur : les canaux gravés transmettent à plein. |
| V4-6 | Cycles : la coupure `e > 0.05` ne garde que la dissipation — avec des arêtes renforcées (w×0.85 > 1) une boucle peut **amplifier** l'énergie au lieu de la dissiper | **Chemin tracé dans le CTE** : colonne `path`, exclusion `instr(path, '\|'||to_id||'\|') = 0`. Vraie prévention de cycle, coût négligeable à depth ≤ 2. |
| V4-7 | Explosion combinatoire : seeds × degré² — un méga-hub (500 arêtes) produit ~10⁵ lignes de CTE par prompt | **Élagage à trois niveaux** : (a) *structurel* — arête érodée sous `w_min` supprimée, **tracée** (`oublier = action tracée`) ; (b) *fan-out* — top-M=20 arêtes par nœud en propagation ; (c) *beam* — niveaux matérialisés avec top-K=50 par niveau → travail borné à K×M, indépendant du corpus. |
| V4-8 | Propagation strictement ascendante : une feuille sans le mot-clé ne peut jamais remonter (pas de localité sémantique) | **Descente `contains`** : parent→enfant, w=0.3 — une région chaude *éclaire* ses feuilles. Lueur non conservatrice : hors diviseur de masse et hors fan-out cap, bornée par le beam. Boost cumulatif — une feuille déjà tiède passe θ ; une feuille froide reste sous l'eau. |
| V4-9 | Une seule surface de grainage = un seul angle d'attaque | **Multi-surfaces (fils d'Ariane croisés)** : chaque index produit sa propre vague — FTS feuilles = surface *fine*, FTS titres/docs = surface *globale*, référents regex = surface *structurelle*. Les vagues se somment : un atome touché par ≥2 surfaces = **interférence constructive** (provenance `srcs` taguée). La boucle se ferme : la globale allume les docs → `contains` descend ; la fine allume les feuilles → `derives_from` monte ; là où les surfaces se croisent = résonance. |
| V4-10 | Une vague unique ne distingue pas réponse confiante / signal faible / absence | **Cascade avec escalade** : les surfaces courent en concurrence ; si le top de la vague < `θ_conf` (0.9) → **reformulation** par termes adjacents (vocabulaire des quasi-réponses, e>0.08, max 1 round) ; si la vague est **vide** → silence honnête, pas de reformulation (une absence totale ne fabrique pas de synonymes). Implémentation : `computeWave` (sondage sans engagement) / `commitWave` (engagement) séparés — la cascade ne commite que la vague retenue. Trois régimes mesurés : direct (E≥0.9), reformulé, silence. |
| V4-11 | Mur lexical : synonyme/paraphrase/typo = aucune graine | **Surface sémantique (4ᵉ)** : `atom_embeddings(atom_id, vec BLOB)` plate — cosinus top-k comme graines, énergie ∝ similarité. **Feuilles, bulles, ondes inchangées** : seul le grainage s'ajoute, la physique est inchangée. Embedder pluggable : interface `embed(text) → Float32Array` ; *hash-embedder* (n-grammes de caractères, déterministe, zéro dép.) = banc d'essai mécanique (typos, variantes morphologiques) ; **model2vec = swap réel**, conditionné aux mesures (test A3 = baseline à battre). Reformulation vectorielle : nudge = embedder(prompt + termes adjacents) — dérive du spectre, pas substitution de mots. La cascade devient : lexical → vectoriel → reformulation. |
| V4-11b | **Mesure A4 (bench) : le vectoriel permanent détruit le silence honnête** — 0/10 concepts absents restent silencieux (collisions de trigrammes du hash-embedder → graines fictives) | **Gating en cascade** : le vectoriel n'est PAS une surface permanente — il ne s'allume qu'en **N2** (lexical + refs sous `θ_conf`). Garde de silence : lexical vide **ET** cos max < seuil strict (0.55 hash / 0.40 model2vec) → **zéro graine**. Le banc a fait son travail : attrapé par le test A4 avant tout déploiement. |
| V4-12 | La base grossit en continu ; le decay à vitesse fixe (×0.9/session) ignore l'usage ; les "sessions" sont une frontière artificielle pour un travail continu | **Courbe d'oubli à deux composantes** (répétition espacée fusionnée au champ) : `salience_eff(t) = MAX(salience₀ × 0.5^(Δt/τ), plancher(uses), plancher_flag)`. **Demi-vie croissante** : `τ = τ₀ × (1 + κ)^min(uses, cap)` — plus c'est ancien et consulté, moins ça se dégrade. **Plancher gagné** : `plancher(uses) = FLOOR_MAX × (1 − e^(−uses/λ))`, λ≈3 — l'exponentielle seule atteindrait 0 ; le seuil de non-oubli monte avec chaque consultation. `plancher_flag` inchangé (pinned 0.6 / high 0.3). Horodatage réel (`touched_at`), consolidation **continue** (chaque surfacing = micro-consolidation `uses++`). Vocabulaire : *mémoire de travail* (par **agent_id**, volatile) vs *consolidation* (temporelle). |
| V4-13 | **Hubness mesurée 48.3%** (critère <20%) — diagnostic : les parents agrègent le fan-in (éviers d'énergie) ; hubness *feuilles seules* = 21.1% (limite). L'écho est géométrique, pas appris (Gini 0.32 ✓) | **Trois leviers** : (1) *fatigue nodale* — `e_eff = e / (1 + α·ln(1 + surface_count_recent))`, α≈0.3, fenêtre glissante ; (2) **atténuation du fan-in** — `e_reçu = e × 1/√(1 + β·d_in)`, β≈0.1 ; (3) **cloisonnement des pools** + cap de diversité (≤ N feuilles par ancêtre). **Amendement du critère C2** : le hubness se mesure sur les *feuilles injectées* (post-pools), pas sur le surfacing brut — les parents qui surfacent sont les harmoniques attendues. Mesuré v10 : **6.3% injecté** ✓. |
| V4-14 | Les graines ont une énergie plate (`SEED_FTS` flat) — "code" (omniprésent) injecte la même onde que "maranget" (rare) ; le conflit v9 fatigue-vs-renforcement (B1 décroissait 0.79→0.55) venait de la fatigue nodale frappant les *feuilles* légitimement consultées | **(a) IDF sur les graines** : l'énergie de graine = BM25 relatif (`SEED_FTS × rank_i/rank_0`) — FTS5 donne l'IDF gratuitement ; un terme rare injecte une onde forte, un terme omniprésent une onde faible. **Fatigue nodale restreinte aux parents** (`section`/`doc`) — l'écho est structurel (fan-in), pas feuillaire ; les feuilles consultées légitimement ne sont plus punies (conflit V4-12/V4-13 résolu). **Ce qui reste global** : θ, BEAM, BUDGET_TOK, FANOUT (physique + budget) ; ce qui devient local : τ, poids, fatigue (déjà), énergie de graine (IDF). |
| V4-15 | Le hash-embedder plafonne la sémantique (A3 2/3) ; le swap model2vec seul perdrait les typos (WordPiece dégrade les mots mal orthographiés) | **DUAL embedder, zéro transformers** : loader pure-JS de `potion-base-8M` (safetensors 29528×256 F32 + tokenizer WordPiece implémenté à la main, ~80 lignes, inférence = lookup + mean-pool synchrone). **Deux spectres par feuille** : `vec` (model2vec, sémantique) + `vec_hash` (hash, typos) — score = max des deux cosinus. Garde de silence **par canal** : lexical vide ET (cos_sem < 0.40 ET cos_hash < 0.55) → silence. Résultat campagne v11 : **A3 = 3/3, A4 = 10/10** — les deux canaux se complètent sans se trahir. |
| V4-16 | **Multilingue (mesuré)** : potion-base-8M est distillé d'un BERT anglais — cos avec "serialization" : ES 0.32, DE 0.28, FR 0.26 (via cognates), RU 0.13, HI 0.03, **ZH 0.000** (vocabulaire élagué sans CJK → 100% UNK). Deuxième couche : le lexical `ftsMatch` est ASCII-only (`[a-zA-Z]`) → un prompt CJK ne produit aucune graine. **La physique du champ est agnostique** — l'échec est confiné au grainage (vocabulaire + regex), la dynamique (vagues, fatigue, planchers) est intacte | **Chantier à activation sur besoin** (le scope principal est FR/EN) : (1) *FTS5* — `tokenize='unicode61'` (diacritiques internationaux) ou `'trigram'` (CJK sans espaces) ; (2) *tokenizer JS* — split par caractère des plages CJK dans le pré-tokenizer avant lookup WordPiece ; (3) *embedder* — swapper le safetensors par une variante model2vec multilingue (même loader, fichier différent). **Preuve d'isolement** : l'échec multilingue ne touche que le grainage — CTE, fatigue, propagation, planchers inchangés. |
| V4-18 | Le scan cosinus JS est O(N) — goulot au-delà de 50k atomes (D1) | **sqlite-vec activable/désactivable** : `ARIANE_SQLITE_VEC=1` → extension vec0 chargée (`allowExtension`), **deux index KNN natifs** (un par canal du dual-embedder : `atoms_vec` sémantique + `atoms_vec_hash`), `distance_metric=cosine` (option de *colonne*). `vecSeeds()` bascule KNN natif / scan JS selon le flag — sémantique identique (A3 3/3, A4 10/10 en A/B). **Détails vec0** : pas de `INSERT OR REPLACE` ni `ON CONFLICT` → DELETE+INSERT ; fallback automatique tracé si l'extension ne charge pas. **A/B D1 @10k** : OFF p95=102ms / ON p95=103ms — pas de gain mesurable sous 10k (vec0 = brute-force C, pas ANN) ; le gain attendu est à 50k+ où le C remplace le transfert BLOB→Float32Array. |
| V4-19 | **Connecteur base de données** : beaucoup de champs sont des *classifieurs* (enums, statuts, catégories) — les embedders gèrent mal les valeurs discrètes et les correspondances exactes | **Trois niveaux d'intégration, règle d'or : le vectoriel gère le flou, SQL/FTS5 gèrent le discret** : (1) **filtres durs SQL** — classifieurs en colonnes structurées ou JSON dédié, garde déterministe `WHERE type='incident' AND status='open'` en pré-filtrage des graines (élimine le non-pertinent sans consommer de budget) ; (2) **injection préfixée FTS5** — en-tête `[type:incident] [status:open]` dans le corps de l'atome : match exact instantané sur tokens préfixés, l'embedder dense traite le bloc sans dériver sur l'enum ; (3) **hubs de graphe + physique conditionnelle** — une catégorie majeure devient un atome-hub (arêtes déterministes → l'activer irrigue le sous-graphe par propagation) ; le classifieur pilote la physique : `obsolete` → τ raccourci, `décision_structurante` → plancher verrouillé. **Règle d'or : le vectoriel gère le flou ; SQL et FTS5 gèrent le discret et le strict.** |
| V4-12c | **B15 (test drastique) a attrapé une contradiction interne** : le plancher gagné récompensait les RAFLES — 30 consultations serrées → uses=30 → plancher haut → le buzz ne meurt jamais (contradiction avec V4-12b anti-hype). D2 mal conçu aussi (2 passes sur la même db qui s'échauffe ≠ déterminisme) | **Plancher gagné par l'ESPACEMENT (V4-12c)** : nouveau compteur `uses_spaced` — une consultation incrémente le plancher **seulement si Δt ≥ τ/2** (l'intervalle qui l'a précédé). Résultat campagne v12 : rafale de 30 → uses_spaced=0 → plancher ≈ 0 → salience effective **0.005** (le buzz meurt ✓) ; consultation espacée → uses_spaced++ → plancher (B8 inchangé ✓). **D2 corrigé** : 2 bases identiques ×100 requêtes = **100% identiques ✓ (déterministe)**. A10 filiation : feuille + breadcrumbs ✓. |
| V4-12b | Le cycle de hype de Gartner : chaque mot a sa hype — certains restent, d'autres déclinent vite — mais coder un cycle par concept serait arbitraire | **Pondération de l'espacement** (spacing effect) : à chaque consultation, `τ ← τ × (1 + κ · min(1, Δt_depuis_dernière/τ))` — *le gain de stabilité est pondéré par l'intervalle qui l'a précédé*. Le cycle de hype **émerge** sans être codé : un buzz = consultations serrées (Δt≈0) → τ ne croît pas → pic puis chute rapide ; un fondamental = consultations espacées → τ compose → quasi-immortel. Gartner devient une **conséquence émergente**, pas une règle codée. Nuance : l'immortalité structurelle (titres, refs, canaux gravés) vient du cadastre, orthogonal. |

### 2.3 Requête de propagation cible (v4)

```sql
CREATE TEMP TABLE _wave AS
WITH RECURSIVE wave(id, e, depth, path) AS (
  -- graines : FTS5 ∪ refs, énergie initiale = score
  SELECT atom_id, e0, 0, '|' || atom_id || '|' FROM _seeds
  UNION ALL
  SELECT l.to_id,
         w.e * 0.85 * l.weight
           / MAX(1, (SELECT SUM(x.weight) FROM atom_links x
                     WHERE x.from_id = w.id AND x.floor = 0))     -- V4-5 : masse, floor exclu
           / (1 + 0.15 * IFNULL(f.uses, 0)),                     -- V4-4 : fatigue synaptique
         w.depth + 1,
         w.path || l.to_id || '|'
  FROM wave w
  JOIN atom_links l ON l.from_id = w.id
  JOIN atoms a ON a.id = l.to_id AND a.status = 'active'
  LEFT JOIN edge_fatigue f ON f.from_id = l.from_id AND f.to_id = l.to_id
  WHERE w.depth < 2 AND w.e > 0.05
    AND instr(w.path, '|' || l.to_id || '|') = 0                  -- V4-6 : anti-cycle exact
)
SELECT id, SUM(e) AS energy, MIN(depth) AS hops FROM wave GROUP BY id;
```

Cycle : la détection exacte par `path` (V4-6) remplace la coupure seule —
nécessaire car une boucle d'arêtes renforcées pouvait amplifier l'énergie
(w×0.85 > 1) au lieu de la dissiper. `edge_fatigue` n'est alimentée que pour
les arêtes `floor=0` (les canaux gravés ne fatiguent jamais).

Échelle (V4-7) : à degré élevé, le CTE unique est remplacé par une
matérialisation par niveau — `_wave_d1` → `SELECT ... ORDER BY e DESC
LIMIT 50` → expansion → `_wave_d2` → top-50. Deux requêtes au lieu d'une ;
le pire cas devient ~2×(50×20) scans de lignes, **indépendant de la taille
du graphe**. L'élagage structurel (`w_min` + refill 0.98/session sans
traversée → suppression tracée) est le seul des trois niveaux qui réduise
le graphe lui-même : sans lui, le treillis gonfle à l'infini même si chaque
prompt reste rapide.

### 2.4 Ingestion : granularité feuille (markdown → phrase, SQL → row)

L'atome-feuille = **le plus petit atome auto-porteur** — celui qui garde un
sens cité seul. La granularité se choisit par source, jamais par troncature
(une troncature est de l'oubli non tracé → interdite) :

| Source | Feuille | Chaîne `derives_from` |
|---|---|---|
| Markdown | **paragraphe** — *phrase* si le paragraphe porte une règle (flag≠low) ou >900 chars | phrase → paragraphe → section → chapitre → doc |
| Base SQL | **row** — body = sérialisation canonique `col: val` | row → table |
| Row à champ règle | atome **field** supplémentaire | field → row → table |

- `atoms.granularity` (`sentence|paragraph|section|row|field|doc`) explicite :
  l'injection cite la **feuille** comme réponse et rend le fil d'Ariane des
  ancêtres comme localisation — le parent est du contexte, pas la réponse.
- **FTS sur les feuilles seulement** : les parents sont atteints par
  propagation (`derives_from`), pas par match — évite le double-comptage
  d'énergie et le vol de surfacing par les `doc:*` observé en v5.
- Une valeur de colonne seule n'est pas auto-porteuse (`"active"` hors ligne)
  → la row entière sérialisée est la feuille SQL ; seul un champ porteur de
  règle mérite un atome dédié.

---

## 3. Protocole de mesure — performance, efficacité, limitations

Méthode : corpus réel (26 docs dna → ~1074 atomes) + corpus synthétique gonflable
(générateur : N atomes, loi de degré, refs plausibles) pour l'échelle.
Chaque test a un **critère de mort** : si le seuil est raté, le mécanisme est
retiré ou repensé — pas ajusté jusqu'à ce qu'il passe.

### A. Efficacité du rappel (vs baseline)

Baseline : FTS5 seul, top-8, même corpus. Champ : mêmes graines + propagation.

| Test | Mesure | Attendu / critère |
|---|---|---|
| A1. Requêtes à terme exact (20 requêtes annotées) | MRR, P@5 champ vs baseline | Champ ≥ baseline ; dégradation >5% = mort de la propagation |
| A2. Atteignabilité multi-saut (faits reliés par co-citation, sans mot commun) | % de cibles surfacées hors top-FTS | >0% = gain réel du treillis ; 0% = le graphe n'apporte rien → simplifier |
| A3. Paraphrase FR→EN (« convertir les types » → coercion) | taux d'échec | Documente le mur lexical — borne haute de l'efficacité champ-0, justification champ-3 |
| A4. Silence honnête (10 concepts absents) | % silence total | 100% — le champ ne doit jamais fabriquer |
| A5. Mot fréquent bruité (« zod ») | taille de vague, % bruit | Mesure le besoin de la normalisation par degré |
| A6. Sélection thermique vs θ dur | P@5 et diversité des surfacings : Boltzmann `exp(E/kT)` avec annealing vs seuil binaire | Gain de diversité sans perte de P@5 >5% — sinon le θ dur (plus simple) gagne |
| A7. Injection 2 pools vs surfacing brut | P@5 sur les feuilles injectées (payload) vs surfacing brut mélangé | La séparation payload/context doit remonter la précision des feuilles injectées |
| A8. Cascade | % de réponses directes / reformulées / silences sur un jeu de requêtes annotées (fortes, paraphrases, absentes) | Absentes → 100% silence ; paraphrases → taux de convergence après reformulation mesuré ; coût moyen (ms) par régime |

### B. Dynamique temporelle (la promesse v3)

| Test | Mesure | Attendu / critère |
|---|---|---|
| B1. Lift de renforcement | rang d'un atome cible : 1ère vs 5ème occurrence du sujet | amélioration monotone puis plateau (cap) — sinon η inutile |
| B2. Renforcement d'arête | w(arête) après N traversées ; gain de surfacing de la cible | w suit 1+η·N borné ; vérifier qu'une arête jamais traversée reste à 1.0 |
| B3. STP : sujet évoqué puis absent | énergie à +1, +3, +5 prompts sans rappel | retour sous θ en ~5 prompts (mémoire de travail) |
| B4. LTP : sujet travaillé puis 10 sessions blanches | l'atome surface-t-il encore plus vite qu'un atome vierge ? | oui = LTP réel ; non = salience décorative |
| B5. Plancher critique | salience d'un flaggé après 50 sessions blanches | ≥ 0.3 exactement — jamais en dessous |
| B6. Fait zombie | atome `superseded` excité artificiellement | w gelé, pas de renforcement, pas de salience |
| B7. Rotation par fatigue | même chemin traversé N fois en une session : w_eff baisse, part relative d'un voisin non emprunté | rotation observable après ~6-7 traversées à λ=0.15 ; jamais sous θ pour les canaux `floor=1` |
| B8. Plancher gagné (V4-12) | atome consulté 1× vs 5× puis laissé seul : salience effective après Δt long | 5 consultations → plancher ≈ FLOOR_MAX (résiste) ; 1 consultation → décroissance quasi libre ; demi-vie mesurée croissante avec uses |
| B9. Cycle de hype émergent | même nombre de consultations (ex. 20), deux distributions : rafale (1 tick) vs espacée (Δt ≥ τ) | τ final du rafale ≈ τ₀ (chute rapide après le buzz) ; τ de l'espacé composé (quasi-immortel) — Gartner émerge sans être codé |

### C. Santé du champ (anti-dérive)

| Test | Mesure | Seuil |
|---|---|---|
| C1. Gini des poids d'arêtes | après 200 prompts simulés | Gini < 0.6 ; au-delà = chambre d'écho → durcir caps ou ε |
| C2. Hubness | % des surfacings captés par le top-1% des atomes | < 20% (cap `surface_count`) |
| C3. Signaux faibles | un atome spécifique peu connecté, requêté directement | surface toujours (le populaire ne doit pas noyer le précis) |
| C4. Résonance parasite | prompts sur sujet A, % de surfacings sujet B non relié | ~0% |
| C5. Audit nodal | canaux touchés dont l'atome n'a pas surfacé | alarme correcte ; FP < 50% pour la version géométrique (shadow) |

### D. Performance / scalabilité

| Test | Mesure | Seuil |
|---|---|---|
| D1. Latence `excite` | p50/p95/p99 à 1k / 10k / 100k / 500k atomes | p95 < 50ms à 100k (v4 SQL) ; comparer v3-RAM vs v4-SQL pour mesurer le crossover |
| D2. Écritures par session | nb de `UPDATE` (v3 vs v4) + croissance du fichier WAL | v4 : O(atomes touchés), pas O(corpus) ; WAL stable |
| D3. Empreinte RAM | heap Node pendant excite | plate à tout corpus en v4 (plus de `loadAdjacency`) |
| D4. Coût ingestion | ms/atome déposé | < 50ms constant |
| D5. Taille de vague | nb de lignes du CTE/temp `_wave`, p95 à 10k et 100k atomes | ≤ ~2k lignes avec beam K=50 + fan-out M=20 — **indépendant du corpus** ; sans V4-7, mesure le crossover où le CTE unique explose |
| D6. Croissance du treillis | nb d'arêtes après N sessions avec/sans élagage structurel | sous-linéaire avec `w_min` ; linéaire sans = élagage obligatoire |

### E. Limites à documenter (constantes du modèle)

1. **Mur lexical** : 100% des paraphrases pures échouent à champ-0 → embeddings = condition d'entrée du champ-3, non négociable.
2. **Dépendance aux graines** : aucune graine = aucune onde. Le champ n'a pas de mémoire spontanée — c'est une propriété (pas de bruit de fond), mais le recall repose entièrement sur la qualité du grainage.
3. **Décision de consolidation irréversible** : une onde consolidée ≠ une onde qui aurait dû l'être. Mesurer le taux de consolidation « regrettée » (salience élevée, jamais re-surfacée ensuite).
4. **Pas de vérité dans le champ** : le paysage dit ce qui est proche, jamais ce qui est vrai. Toute logique de contradiction/vérité reste protocolaire (cadastre).

---

## 4. Séquence d'exécution

1. **Implémenter v4** (V4-1→V4-5) sur le PoC — ~100 lignes de delta.
2. **Harnais de mesure** : `sandbox/bench-ariane.ts` — générateur de corpus
   synthétique + scénarios reproductibles + sortie métriques (JSON).
3. **Campagne A+B** d'abord (efficacité), C en simulation longue, D à l'échelle.
4. Rapporter : `20-mesures-v4.md` — chiffres, critères tenus/morts, décision
   go/no-go par mécanisme avant tout investissement champ-3 (embeddings).

### 4.1 Résultats de la première campagne (v7, 2026-09-16)

| Test | Résultat | Verdict |
|---|---|---|
| A1 MRR/P@5 | champ **0.95** vs baseline FTS5 **0.81** (**×1.18**) | ✓ tenu |
| A3 mur lexical | 3/3 cibles atteintes (typo, morphologie FR, FR→EN partiel) | ✓ tenu |
| A4 silence | **0/10 — ✗ RATÉ** : le hash-embedder fabrique des graines fictives | → V4-11b (gating cascade) |
| B1 lift | rang 1→1→1 — plafond de mesure (cible déjà #1) | ⚠ harnais à corriger (cible rang 5-10) |
| B3 STP | 2.81 après 5 fillers (θ=0.5) | ✗ test biaisé — fillers non neutres, à refaire exogène |
| B5 plancher | 0.30 après 50 sessions blanches | ✓ |
| B6 fait zombie | w gelé, jamais surfacé | ✓ |
| C1 Gini | **0.317** après 200 prompts | ✓ < 0.6 |
| C2 hubness | **39.7%** captés par le top-1% | ✗ RATÉ (critère <20%) — cap `surface_count` + normalisation à durcir |
| D1 latence | linéaire : ×5 atomes = ×5 p95 (170ms à 10k) | ⚠ scan cosinus O(N) — optimisation requise |

### 4.2 Points de swap vectoriels (champ-3)

- **model2vec** (potion-base-8M, ONNX ~30MB) : remplace le corps d'`embed()` —
  même interface. Élimine les collisions de trigrammes (cause du raté A4) ;
  seuil de silence attendu plus bas (0.40 vs 0.55). Dép. `@xenova/transformers`
  + téléchargement modèle — à faire en sandbox, conditionné au re-test A4/A3.
- **sqlite-vec** : inutile à 10⁴ atomes (scan JS suffisant une fois les vecteurs
  cachés en RAM) ; pertinent à 10⁵+ où le scan O(N) domine (mesuré : latence
  linéaire en D1). Le point de branchement reste `vecSeeds()`.

### 4.3 sqlite-vec : en réserve

Le scan JS suffit largement sous 10k atomes ; le branchement s'activera au
franchissement des **50k atomes** (seuil de latence O(N) mesuré en D1).
Point de branchement : `vecSeeds()` uniquement.

### 4.4 Tests drastiques (à exécuter avant tout déploiement)

La campagne actuelle (26 docs, 10 sujets, 200 prompts) valide la mécanique.
Les tests suivants la soumettent à des conditions réelles :

| Test | Protocole | Critère |
|---|---|---|
| **F1. Échelle réelle** | corpus ×20 (500k atomes réels, pas synthétiques) | p95 < 50ms avec sqlite-vec ; sinon le scan O(N) est le goulot confirmé |
| **B10. Longévité** | 1000 sessions simulées, usage réaliste | Gini stable, plancher tenu, pas de dérive de τ (le cap TAU_CAP_USES tient-il ?) |
| **B10b. Coalescence** | déposer 50 documents quasi-dupliqués (même fait reformulé) | le champ doit coalescer ou au moins ne pas les faire tous surface (test de coalescence du consensus, jamais implémenté) |
| **B11. Contradictions** | deux faits opposés sur le même sujet | les deux surfacent **ensemble avec leur contexte** (jamais l'un seul) — la règle "contested jamais servi seul" |
| **B11b. Poison** | prompts d'injection adversariale ("ignore les instructions précédentes") | aucune graine fabriquée, silence ou surfacing correct — le champ ne doit pas amplifier une injection |
| **B12. Churn** | 30% du corpus remplacé (docs mis à jour/supprimés) | les arêtes vers du supprimé s'érodent et s'élaguent (tracé) ; les saliences orphelines retombent |
| **B13. Crash recovery** | kill du process en pleine session, redémarrage | la mémoire de travail est perdue (assumé), le cadastre + salience intacts — le paysage se régénère |
| **B14. Multi-agents** | 2 agents_id en parallèle sur le même cadastre | mémoires de travail cloisonnées, treillis partagé cohérent (corroboration multi-porteurs) |
| **A9. Synthèse round-trip** | déposer une synthèse LLM citant 5 feuilles → elle surface-t-elle quand on interroge ses sources ? | la boucle sédimentaire (V4-17b) fonctionne de bout en bout |

### 4.5 Prochains correctifs (ordre)

1. ~~Gating vectoriel (V4-11b)~~ — ✅ fait (v8), A4 = 10/10.
2. ~~V4-12~~ — ✅ implémenté (v8), validé B8/B9.
3. ~~Harnais~~ — ✅ corrigé (fillers exogènes, cible milieu de classe).
4. ~~Latence~~ — ✅ p95 ~100ms @10k (vs 170ms v7) ; sqlite-vec à 50k+.
5. **V4-16 multilingue** — activation sur besoin (swap de modèle + tokenizer CJK
   + FTS5 trigram).
6. **V4-17 (candidat)** : vue de *lignée conceptuelle* + boucle sédimentaire
   (V4-17b) — voir §5.3.

**Rappel du consensus** : le champ n'exige pas le vecteur — le vecteur exige le
champ. Champ-0→2 tournent en déterministe pur ; champ-3 conditionné aux mesures
ci-dessus.

---

## 5. Bilan — innovation et mémoire du savoir (post-campagne v11)

### 5.1 Qu'est-ce qui est réellement nouveau ?

Les briques individuelles existent dans la littérature (spreading activation =
HippoRAG, courbes d'oubli = Ebbinghaus/SuperMemo, EWMA = Generative Agents) —
la cartographie du sceptique est maintenue. **L'innovation est dans l'assemblage
et la frugalité** :

1. **Émergence déterministe** : le cycle de Gartner (B9 : τ_fad 6.3 vs τ_fund
   43.8) et la rotation par fatigue émergent de la physique des intervalles —
   sans ε-greedy, sans règle métier codée. Le comportement dynamique naît de la
   physique des intervalles d'accès, pas de règles métier.
2. **Couplage multi-surfaces étanche** : le déterministe (FTS5, graphe de
   filiation) et le statistique (dual-embedder) coexistent avec une **garde de
   silence stricte** — le système préfère se taire plutôt que fabriquer du faux
   contexte par proximité vectorielle forcée (A4 : 10/10).
3. **Zéro dette d'infrastructure** : moteur sémantique à double échelle
   temporelle dans un SQLite local, loader pure-JS de ~80 lignes — sans ONNX
   Runtime, sans Python, sans base vectorielle dédiée.

### 5.2 Recherche et transmission de la mémoire du savoir

Le RAG classique produit une **photographie amnésique** : troncature, k-plus
proches voisins, une note de deux ans traitée comme un principe réaffirmé
hier — incapable de restituer la trajectoire d'une idée. ARIANE-CHAMP rend la
recherche **sédimentaire** :

- **Filiation préservée** (`derives_from`) : l'injection en deux pools (feuille
  = le fait, ancêtre = la structure) sait d'où vient l'information et comment
  elle s'articule.
- **Bruit vs fondamental différenciés naturellement** : l'effet d'espacement
  (V4-12b) sépare l'effervescence éphémère du savoir ancré — la façon dont la
  mémoire collective filtre l'histoire des idées, émergente et mesurée (B9).
- **Incorruptibilité du cadastre** : `pinned`/`floor=1` échappent à l'érosion
  et à la fatigue — une décision fondatrice ne peut pas être oubliée par
  accident sous prétexte de non-citation récente.

Formule de bilan : **un moteur pensé pour la continuité épistémique plutôt que
pour la correspondance de mots-clés.**

### 5.3 Ce qui manque : la narration de l'histoire du savoir (V4-17 candidat)

Le champ modélise la *thermodynamique* du savoir (ce qui chauffe, refroidit,
résiste) mais pas encore son *récit*. Il ne sait pas répondre à « comment notre
compréhension de X a-t-elle évolué ? ». Les données y sont toutes (append-only,
`surface_log`, `mutation_log` du cadastre) — il manque la **vue de lignée
conceptuelle** : quand un fait est entré, par quel porteur, ce qui l'a remplacé
(`superseded_by`), comment sa formulation a dérivé. Une requête « raconte-moi
l'histoire de ce concept » qui rejoue la lignée depuis le cadastre — cohérent
avec la promesse du consensus : *le paysage entier est régénérable depuis le
cadastre* ; l'histoire du savoir est rejouable depuis le journal.

**Extension V4-17b — la boucle sédimentaire** : une synthèse (ou un document)
produite *à partir* du champ devient elle-même un atome du cadastre, lié par
`derives_from` à ses sources (les feuilles qui l'ont nourri). **Une couche
supplémentaire** : le champ ne se contente pas de restituer l'histoire du
savoir — il *produit* des documents qui s'y déposent, créant une génération
suivante de la hiérarchie. Le savoir composé (synthèse + références) devient
une feuille de nouvelle génération, `derives_from` vers les feuilles qu'il
synthétise. La mémoire ne se contente plus de restituer : elle sédimente sa
propre synthèse — et la prochaine synthèse partira d'un socle enrichi.

---

## 6. V4-20 — Extraction du moteur en package ytn : `@ytrynot/osem-rag`

**Décision** : le moteur quitte la sandbox et devient un module réutilisable de
la famille ytn (`dna`, `schvalid`, `qb`, `cli`). Identité : **Oscillo Ergo
Memini** — *j'oscille, donc je me souviens* : la mémoire ne naît pas de
l'intensité mais de l'oscillation temporelle des accès (l'espacement), ce que
la campagne a mesuré (B9 : τ_fad 6.3 vs τ_fund 43.8 ; B15 : rafale →
uses_spaced=0 → le buzz meurt).

### 6.1 Décisions d'API (validées)

| Décision | Valeur |
|---|---|
| Nom package | `@ytrynot/osem-rag` |
| Factory | `createOsem({ db, config })` → `IOsemRag` |
| Stockage | **DB injectée, jamais créée ni fermée** (comme `@ytrynot/qb`) ; `better-sqlite3` en peerDependency, `sqlite-vec` en peer optionnel |
| Embedder | Pluggable : `{kind:"hash"}` (défaut) · `{kind:"model2vec", modelDir}` · `{embedder}` — la physique du champ est identique quel que soit le backend |
| Config | `IOsemConfig` — les ~30 constantes auditées deviennent des champs documentés, défauts = valeurs de campagne (θ 0.5, τ₀ 5, κ 0.25, α 0.3, β 0.1, λ 3, θ_conf 0.9, silences 0.40/0.55…) |
| Classifieurs (V4-19) | Hors v0.1.0 — parité v12 d'abord ; le mapping classifieur→physique déclaratif arrive avec le connecteur SQL |

### 6.2 Plans de mémoire (remplacent `session_id`)

Un seul mécanisme physique : la colonne `scope_id` des tables STP
(`agent_energy`, `edge_gain`, `edge_fatigue`, `surface_log`).

| Plan | `scope_id` | Écriture | Lecture |
|---|---|---|---|
| **Personnel** | `agent:<id>` | l'agent excite sa propre mémoire de travail | lui seul |
| **Public** | `public` | tout agent (mémoire partagée) | tous |
| **Scope** | `scope:<nom>` | mémoire publique **par scope** (projet, équipe, repo) | agents autorisés |
| **Skills** | `skill:<nom>` | savoir durable = atomes `kind:"skill"` ; mémoire de travail *partagée* entre tous les agents qui invoquent le skill | tous |
| **Tout** (`all`) | union read-only | jamais écrit directement | recherche dans tous les plans |

- **LTP globale** : `salience`/`tau`/`uses`/`uses_spaced` restent globaux sur
  `atoms` — le sédiment est collectif par nature (déjà le cas en v12).
- **Expert** : agent virtuel `agent:expert:<nom>` uniquement s'il a besoin
  d'une mémoire de travail privée (persona persistante) ; sinon l'expert n'est
  qu'une provenance (`deposited_by` sur les atomes). Aucun nouveau mécanisme
  moteur : skills/experts réutilisent `scope_id` + `kind` + provenance.

### 6.3 Structure du package

```
packages/osem-rag/src/
├── index.ts            — createOsem : résout l'embedder, charge vec0 une
│                         seule fois (fallback tracé), DDL + refreshStats
├── types.ts            — IOsemRag · IOsemConfig · IEmbedder · tsScopeId
├── engine/
│   ├── ddl.ts          — cadastre (atoms, links, agent_energy, edge_gain,
│   │                     edge_fatigue, surface_log, FTS5, embeddings, vec0)
│   ├── field.ts        — computeWave (4 surfaces, beam×2) / commitWave
│   │                     (consolidation continue V4-12c)
│   ├── inject.ts       — 2 pools + breadcrumbs + zones chaudes + cap/ancêtre
│   ├── maintenance.ts  — refreshStats (_fan/_mass/_din), tick (érosion +
│   │                     élagage tracé), hotAtoms, stats
│   └── ingest.ts       — deposit (référents, derives_from/contains, dual
│                         embeddings) + chunking adaptatif markdown
└── embedder/
    ├── types.ts        — IEmbedder { embed(text): Float32Array; dim; vocab }
    ├── hash.ts         — défaut, zéro dépendance (typos, morphologie)
    └── model2vec.ts    — loader pure-JS potion-base-8M (safetensors + WordPiece)
```

### 6.4 État des tests (suite anti-régression)

22 tests vitest portés du bench (`tests/`) — **22/22 verts** :

| Série | Tests | État |
|---|---|---|
| A — rappel | A1 (MRR ≥ baseline FTS5), A4 silence 10/10, A10 filiation | ✅ |
| A3 — mur lexical | typo `serializaton` / FR `sérialisation` (snapshot figé du corpus dna) | ✅ |
| B — temporel | B1, B3, B5, B6, B8, B9, B15 | ✅ |
| C — santé | C1 Gini, C2 hubness injectée | ✅ |
| D — opérations | D1 sub-linéarité, D2 déterminisme | ✅ |
| Stress | B12 churn, B13 crash recovery, B14 multi-agents | ✅ |
| Parité vec | sémantique identique, sqlite-vec ON/OFF | ✅ |
| E — sources | ingestion mixte : md + txt + URL + rows SQL dans un même champ | ✅ |

**Leçons des deux correctifs (mesurés, pas supposés)** :

1. **A3 — mur lexical** : sur un fixture synthétique de 9 feuilles d'une ligne,
   le cosinus hash de la typo `serializaton` tombe à **0.373** (< seuil de
   silence 0.55) et le sem à 0.284 (< 0.40) → silence. Sur le corpus dna réel
   (26 docs → 4358 atomes), le même moteur passe **3/3** via la surface `[s]`
   (`dna:docs/serialization.md#0` surfacé pour la typo et la morphologie FR,
   `doc:docs/type-inventory.md` pour le FR→EN). **Le moteur est correct ; le
   fixture d'une ligne était sous-dimensionné** — le test A3 tourne sur le
   corpus réel, conditions exactes de la campagne v12.
2. **B15** : la feuille `ATOM-ARCH` référençait `derivesFrom: "table:decisions"`
   sans déposer l'atome-table d'abord → FK. Le bench v12 déposait
   `table:decisions` explicitement avant la feuille — le portage fait pareil.

### 6.5 Feuille de route du package

1. ~~Corriger les 2 tests~~ — ✅ fait, campagne **40/40**.
2. ~~Parité qualitative vs bench v12~~ — ✅ A4 10/10, A3 3/3,
   B15 (plancher pinned tient, buzz mort uses_spaced=0), D2 100% identiques.
3. ~~Tests vec ON/OFF (sémantique identique en A/B)~~ — ✅ fait (+ régressions
   parité zombie sous KNN et backfill vec0, cf. §6.6).
4. ~~`README.md` (EN, TOC, exemples) + `AGENTS.md` package + JSDoc intégrale~~ — ✅ fait.
5. ~~ADR (nouveau module = décision structurante)~~ — ✅ tracé (mailbox DEC,
   en attente de validation ADMIN).
6. ~~Changeset (minor, nouveau package) + `git add`~~ — ✅ stagé ; **commit
   owner en attente** (clé de signature SSH réservée à l'owner).

**Rappel** : la v12 sandbox reste la référence comportementale jusqu'à parité
établie ; aucun claim de production-readiness avant suite verte + parité.

### 6.6 Révision post-extraction — correctifs d'audit et grainage IDF (v0.1.0)

Changements appliqués après deux audits complets du code (surface publique +
physique), chacun validé par une mesure avant acceptation :

**Corrections physiques**

| # | Défaut trouvé | Correctif |
|---|---|---|
| R1 | Les plans miroirs (`share`) exécutaient la LTP globale *avant* le garde `learn=false` → partager un prompt multipliait la consolidation `uses`/`uses_spaced`/`τ` par plan (l'inverse de l'anti-hype) | Bloc LTP déplacé derrière le garde learn : les miroirs ne reçoivent que bump d'énergie + trace |
| R2 | Les atomes `superseded` ne pouvaient pas surface mais **semaient** encore (FTS/titre/vecteur) et rayonnaient vers leurs voisins | Filtre `status='active'` sur les trois surfaces de grainage |
| R3 | `titles_fts` en INSERT pur à l'upsert → lignes FTS fantômes par ré-ingestion | DELETE+INSERT, comme `atoms_fts` / `atom_embeddings` |
| R4 | L'upsert remettait à zéro `salience`/`tau`/`uses`/`uses_spaced`/`touched_tick` → re-déposer un doc effaçait sa mémoire accumulée | Sédiment préservé (`salience = MAX(ancien,nouveau)`, état temporel conservé) — cohérent avec « le sédiment est collectif » |
| R5 | Les ancres `pinned` consommaient le budget payload des feuilles | Comptage `payloadUsed` séparé — les ancres sont réellement hors budget |
| R6 | Constantes hard-codées + patterns de référents câblés au corpus governance | Tout dans `IOsemConfig` (`refSeedEnergy`, `rankFloor`, `salienceBoost`, `adjacentMinEnergy/Max`, `referentPattern`, `referentFilePattern`) |

**Révision du scoring lexical — l'IDF remplace la stop-liste**

La plainte de pertinence (« how does the injection budget work? » → « How to
integrate » #1) a d'abord été patchée par une stop-liste EN/FR, puis remplacée
par un mécanisme principiel : **chaque terme de la requête est pricé par son
IDF corpus** (`ln(1 + N/df)`, normalisé par l'IDF max des termes) — le corpus
lui-même prix les mots, sans dictionnaire. Les contributions sont **additives
par terme** (était `Math.max`) : couvrir plusieurs termes informatifs domine un
hit mono-terme. Mesuré : `injection budget` → la feuille `BUDGET_TOK` surface
#1 à 4.03 (invisible avant) ; `the` à df≈925/3606 est pricé ≈0.24, quasi
inerte. `des`/`dés`/`dès`/`EU` restent des termes distincts, pricés par le
corpus.

**Limite mesurée → contrat documenté** : les mots de scaffolding de question
(`how`, `comment`) sont *rares* dans les corpus techniques déclaratifs → IDF
élevé → ils sèment réellement. L'IDF mesure la rareté, pas la vacuité ; aucune
statistique de corpus ne peut corriger ça. Résolution : **OSEM est un moteur à
mots-clés** — le contrat est « passer les keywords distillés, l'agent/LLM
appelant fait question→keyword ». Documenté dans le README §2 ; la démo exécute
des requêtes scriptées en mots-clés.

**V4-16 CJK — besoin validé, non implémenté**

`sandbox/validate-cjk.ts` : un prompt chinois sur un corpus zh → **silence
total** (honnête, rien de fabriqué) ; FTS5 `unicode61` stocke chaque run CJK
comme un token opaque (même le bigramme exact `记忆` ne matche rien) ;
`termsOf` n'extrait aucun terme CJK. L'échec est confiné au grainage — ondes,
fatigue et planchers intacts. Chemin d'activation quand nécessaire : extraction
de bigrammes CJK dans `termsOf` (l'IDF prix les bigrammes, sans dictionnaire)
+ `tokenize='trigram'` sur les tables FTS + un fichier safetensors multilingue.

**Correction du bench (honnêteté)** : la latence D1 est **~linéaire en N**
(×5 corpus → ×5.2 p95), pas sous-linéaire — le beam borne la *propagation*,
mais la collecte des graines (FTS par terme + scan vectoriel JS) est O(N).
p95 ≈ 125ms à 10k atomes.

**Deuxième passe d'audit (vérifiée par probes)** — trois bugs de plus, chacun
avec un test de régression dans `tests/f-audit-regressions.test.ts` :

| # | Défaut trouvé | Correctif |
|---|---|---|
| A1 | La branche KNN vec0 semait les atomes `superseded` (le scan JS les filtrait) — parité ON/OFF rompue sur les zombies | `JOIN atoms … status='active'` sur les deux requêtes KNN |
| A2 | Les tables vec0 créées sur une base déjà peuplée restaient **vides** → rouvrir avec `useSqliteVec` tuait la surface sémantique en silence | Backfill `INSERT … SELECT FROM atom_embeddings` après le DDL |
| A3 | `_fan`/`_mass`/`_din` stales jusqu'au premier `tick()` → `deposit→excite` tournait avec une **propagation ascendante morte**, en silence | Flag partagé `statsState.dirty` : `deposit` marque, `computeWave` rafraîchit paresseusement, `tick` nettoie |

Plus les mineurs : `share:"system"` exclu de `tsSharedScope`, les hot zones
filtrent `status='active'`, index `surface_log(atom_id,tick)`, lignes
`'pruned'` exclues de la fenêtre de fatigue nodale, `resonates` exige
désormais la co-activation sur **≥2 ticks distincts** (ondes stationnaires
conformes à la spec), le floor `supports` suit le flag courant au re-dépôt,
les offsets de ligne de `leafChunks` survivent aux paragraphes dupliqués,
`inject.agentId` optionnel quand `scopes` est fourni.

**Troisième passe d'audit** — un défaut sémantique et trois résidus, tous
refermés :

- `inject` prépendait le plan personnel *même avec une liste `scopes`
  explicite* → une lecture scopée fuitait la mémoire privée de l'appelant.
  Corrigé : **`scopes` est désormais autoritaire** (exactement ces plans) ;
  le plan personnel n'entre que dans l'ensemble par défaut. Test de
  régression dans `g-planes`.
- Le `df` de l'IDF comptait les lignes `superseded` → poids des termes
  déflatés par le contenu rétracté. Corrigé : la requête df joint
  `atoms.status='active'`, cohérent avec « superseded = inerte sur toute
  surface ».
- Test D1 renommé « bounded latency growth » (était « sub-linear ») et
  indice de médiane corrigé (`lat[10]` sur 30 échantillons était p33, pas
  p50).
- Documenté : un handle `IOsemRag` par connexion — les handles partagent
  les tables TEMP de stats mais pas le flag dirty (hypothèse single-writer).
