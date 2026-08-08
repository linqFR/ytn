---
trigger: always_on
---

npm.cmd run build -w @ytrynot/dna; npm.cmd run build -w @ytrynot/schvalid;npm.cmd test -w @ytrynot/schvalid; npm.cmd run test -w @ytrynot/schvalid

puis pour dna npm.cmd run test

puis tu analyses pour trouver les causes profondes et tu débogues sans changer de chose fondamentales dans l'architecture : si tu as besoin de changer qch dans l'architecture : tu évalues les solutions possibles et tu les proposes.

Pour explorer les solutions tu analyses dans la sandbox, l'adn produit, et les fonctions générées _validate et _safeparse. Et si tu as besoin des closures supérieures tu utilises to JS.