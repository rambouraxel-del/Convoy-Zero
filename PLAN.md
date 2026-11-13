# PLAN

| Phase | Contenu | Critère de sortie | Statut |
|---|---|---|---|
| 0 Audit | Dépôt vide, Node 22, Chromium/Playwright préinstallés, npm accessible | outils vérifiés | ✅ |
| 1 Plan | Architecture modulaire (sim pure / rendu Phaser / UI DOM / persistance / audio) | fichiers mémoire | ✅ |
| 2 Vertical slice | menu → garage → carte → conduite → combat → événement → bilan → garage | e2e vert | ✅ |
| 3 Contenu | 3 véhicules, 5 ennemis + boss, 3 biomes, 10 événements, 14 upgrades run, 6 méta | tests unitaires | ✅ |
| 4 UI/art/audio | textures Canvas procédurales, VFX particules, nuit avec phares, audio Web Audio | captures revues | ✅ |
| 5 QA/équilibrage | simulateur headless (`scripts/balance.ts`), e2e desktop+mobile, captures | voir STATE | ✅ |
| 6 Livraison | README, rapport final, commit | — | ✅ |

Dépendances : sim → (rendu, tests) ; run/save → UI ; tout → e2e.
