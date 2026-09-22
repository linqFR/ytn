# Modèle mémoire OSEM — spécification

> Le contrat implémenté par `@ytrynot/osem-rag` : ce que le moteur garantit, exprimé au niveau du comportement observable. Docs compagnons : [HOW-IT-WORKS](HOW-IT-WORKS.md) (mécanique), [API](API.md) (appels), [cartographie des tests](result-test-suite_EN.md) (vérification), [résultats LongMemEval](results-longmemeval-bench_EN.md) (évaluation externe).

## Table des matières

- [Atomes et granularité](#atomes-et-granularité)
- [Plans de mémoire](#plans-de-mémoire)
- [Deux couches de mémoire](#deux-couches-de-mémoire)
- [Requêtes, commits et silence](#requêtes-commits-et-silence)
- [Fréquence sur fenêtres glissantes](#fréquence-sur-fenêtres-glissantes)
- [Surfacing vs payload](#surfacing-vs-payload)
- [Pins, flags et supersession](#pins-flags-et-supersession)
- [Partage entre plans](#partage-entre-plans)
- [Silence honnête](#silence-honnête)
- [Invariants](#invariants)
- [Non-objectifs](#non-objectifs)

---

## Atomes et granularité

La connaissance est stockée en **atomes** — l'unité de mémoire. Un atome a un corps, un kind, une provenance optionnelle (`src` + ligne) et une **granularité** sur une chaîne fixe :

```text
doc → section → paragraphe → phrase           (markdown / texte)
table → ligne → champ                         (lignes structurées)
```

La **feuille** est la plus petite unité auto-suffisante — l'atome qui garde son sens cité seul. Le dépôt ne tronque jamais : la granularité est choisie par source, et une feuille trop longue pour son budget est *découpée*, jamais coupée. Les parents (`doc`, `section`) sont du contexte, pas des réponses — ils localisent la feuille en breadcrumbs sans jamais voler un slot de payload.

## Plans de mémoire

Toute attention se joue sur un **scope** — un plan de mémoire identifié par une chaîne :

| Scope | Plan | Propriétaire |
|---|---|---|
| `agent:<id>` | le plan personnel de l'agent | l'agent lui-même |
| `public` | le plan collectif partagé | le système |
| `scope:<name>` | un plan partagé nommé (projet, équipe, repo) | premier agent à le revendiquer |
| `skill:<name>` | plan de connaissance d'un skill | le propriétaire du skill |

Les plans sont **indépendants** : chacun porte sa propre mémoire de travail, sa propre histoire d'attention, ses propres statistiques de fréquence. Un agent qui consulte `scope:proj` n'écrit rien sur `agent:beta` — les scopes ne partagent jamais de sédiment.

`actAs` permet au **propriétaire** d'un scope d'agir directement dessus (son horloge, sa mémoire). Une revendication par un non-propriétaire est rejetée avant que quoi que ce soit soit touché.

## Deux couches de mémoire

| Couche | Clé | Durée | Rôle |
|---|---|---|---|
| **Mémoire de travail** (STP) | `(agent, atome)` | échelle session, décroît vite | priming : un sujet récemment soulevé reste chaud dans la session |
| **Mémoire d'attention** (LTP) | `(scope, atome)` | fenêtres glissantes de commits | fréquence : la connaissance consultée avec espacement gagne une présence durable |

Les deux couches ne partagent jamais de clé et ne s'écrivent jamais l'une l'autre. La STP répond « qu'est-ce qui vient d'être actif » ; la LTP répond « à quoi ce scope revient-il sans cesse ».

## Requêtes, commits et silence

Un recall est une **requête déléguée** à un ou plusieurs scopes, pas une lecture de table. Pour chaque scope participant :

1. une vague est calculée sur l'état du scope — surfaces lexicale, référents, titres et sémantique sont en compétition (`recallLexical` reste lexical seul) ;
2. les atomes au-dessus du seuil d'énergie forment le **commit** : la position d'attention du scope avance et chaque atome surfacé est **bookmarké** — un enregistrement append-only portant la provenance (quelle surface l'a trouvé, quel chemin l'a propagé) ;
3. un recall qui ne surface rien est un **silence** : la position du scope actant avance quand même (l'attention a été dépensée) mais aucun atome n'est crédité.

Conséquences qui découlent de cette construction :

- **Les dépôts sont inertes.** Enregistrer de la connaissance ne compte pas comme de l'attention — inonder le corpus d'atomes jamais consultés ne dilue rien.
- **Le silence étranger ne peut pas vider un scope.** Un recall adressé à d'autres scopes n'avance jamais la position du vôtre ; seuls les commits écrits *sur* un scope le font bouger.
- **Pas d'auto-boost.** Une requête ne bénéficie que des commits *passés* — elle ne voit jamais le sien.

## Fréquence sur fenêtres glissantes

L'attention long-terme d'un scope dérive de ses bookmarks récents sur trois fenêtres imbriquées (chaude / moyenne / longue, configurables). L'essentiel :

- **La récence dilue.** Quand la fenêtre glisse, les anciens crédits en sortent — une mémoire non consultée depuis un moment perd son boost de fréquence. Le silence est une dilution, jamais un renforcement.
- **La durabilité exige la dispersion.** Les crédits doivent être répartis sur des commits distincts pour qualifier de durable — une rafale de 30 consultations serrées se concentre dans une fenêtre étroite et meurt avec elle ; les consultations espacées se dispersent et se composent. C'est ainsi que le hype s'éteint pendant que les fondamentaux persistent, sans règle codée.
- **Les parts sont normalisées par scope** sur son propre vocabulaire bookmarké : chaque scope compare les atomes à ce que *lui* consulte réellement, donc un petit scope focalisé et un énorme scope public se classent équitablement.

## Surfacing vs payload

Deux ensembles distincts, délibérément séparés :

- les atomes **surfacés** ont franchi le seuil d'énergie — c'est l'*état de mémoire* et ça gagne du crédit de fréquence ;
- le **payload** est le sous-ensemble rendu dans le contexte sous le budget de tokens — c'est la *présentation*.

Un plafond de rendu n'efface jamais le crédit mémoire : un atome surfacé mais non rendu dans le payload compte quand même comme consulté.

## Pins, flags et supersession

- les atomes `pinned` / à flag élevé gardent un **droit de surfacer** indépendant de la fréquence — une décision fondatrice ne peut pas être oubliée sous prétexte que personne ne la cite ce mois-ci ;
- les atomes `superseded` **ne surfacent jamais** et leurs liens gèlent — un fait rétracté reste mort ;
- les références et pins se résolvent à travers la chaîne de supersession vers la version *vivante* d'une vérité — un pin est une référence à une identité, pas un cliché figé.

L'autorité est scopée : pinner sur `scope:proj` ne pinne pas pour `agent:x`.

## Partage entre plans

`share` sur un recall **mire** le commit sur des plans partagés : les atomes surfacés y sont bookmarkés aussi, marqués comme partagés (avec la provenance du plan actant), mais le miroir ne fait aucun apprentissage de graphe. C'est ainsi qu'un fait déposé par un agent devient restituable par un autre via un scope commun — pendant que les plans privés restent invisibles à tous les autres.

## Silence honnête

Quand aucune surface n'atteint la confiance, le moteur ne retourne **rien** — pas de top-k fabriqué, pas de contexte de remplissage. Le silence est une réponse de première classe et un contrat testé (A4/H7/F4 : 10/10 sur sujets absents).

## Invariants

- **I1 — indépendance des scopes** : aucun recall n'écrit en dehors des scopes sur lesquels il commit ; le silence étranger laisse un scope intact.
- **I2 — le silence dilue, ne renforce jamais** : les fenêtres glissantes ne font qu'effacer la fréquence ; rien ne gagne de crédit sans surfacer.
- **I3 — dépôts inertes** : `N` (le vocabulaire de normalisation) ne compte que les atomes bookmarkés.
- **I4 — pas d'auto-boost** : un commit est invisible à sa propre requête.
- **I5 — pins immunisés** : les atomes flaggés gardent leur plancher de surfacing quelle que soit la fréquence.
- **I6 — déterminisme** : même état de corpus + même prompt → même vague ; pas d'horloge murale dans la physique.
- **I7 — la vérité est append-only** : bookmarks et cadastre ne sont jamais réécrits ; les caches dérivés se rebâtissent exactement depuis eux.
- **I8 — limite d'attribution** : le moteur sait *qui a demandé* (provenance sur les query atoms) et *ce qui a surfacé* — jamais *qui a vu* ; c'est une préoccupation au niveau applicatif.

## Non-objectifs

Le moteur rend des **atomes**, pas des réponses. L'agrégation (« combien de… »), l'arithmétique temporelle (« il y a 10 jours ») et la correction de réponse appartiennent à la couche de lecture au-dessus — le retrieval fournit les sessions de preuve ; les combiner est le travail du consommateur (voir l'[analyse des échecs](results-longmemeval-bench_EN.md#failure-analysis) pour où cette frontière mord).
