# Rapport final — CONVOY ZERO V1.0

## Critères de recette (cahier des charges §14)

| Critère | État | Preuve |
|---|---|---|
| `npm install`, `npm run build`, `npm test` | ✅ | build Vite OK, 130 tests Vitest |
| E2E desktop + mobile | ✅ | `tests/e2e` : 16 passés (Chromium 1280×720 et Pixel 7 paysage émulé) |
| Menu → garage → expédition → carte/rencontre/événement → victoire/défaite → garage | ✅ | e2e « parcours complet » et « défaite » |
| Pilotage auto + manuel | ✅ | e2e clavier, e2e joystick, test unitaire d'évitement |
| 3 véhicules visibles et distincts | ✅ | `sim.test.ts` + captures |
| 5 ennemis testables (+ boss) | ✅ | `sim.test.ts` (un test par archétype + finale) |
| 3 biomes avec risque propre | ✅ | rafales / barils / mines testés ; captures 04, 06, 07 |
| 8 événements | ✅ 10 | `core.test.ts` |
| 12 upgrades de run, 6 permanentes | ✅ 14 + 6 | `run.test.ts` (effet mesurable de chacune) |
| Carte reproductible par graine | ✅ | 60 graines testées |
| Pas de blocage, pas de ressource négative, pas de crash en fin de run | ✅ | fuzz + panne sèche + 30 runs auto + e2e sans erreur console |
| Sauvegarde méta après rechargement | ✅ | e2e + tests migration/corruption/idempotence |
| Volumes audio réglables et enregistrés | ✅ | e2e paramètres |
| Mobile utilisable au toucher, cibles ≥ 44 px | ✅ | e2e tactile + contrôle automatique des tailles |
| Captures PC/mobile vérifiées | ✅ | `docs/screenshots/{desktop,mobile}` revues visuellement |
| Performances / fuites / arrière-plan | ⚠️ partiel | mémoire stable, sim 0,014 ms/pas, pause auto onglet masqué ; FPS réel non mesurable (pas de GPU) |
| README, attribution, limitations | ✅ | README.md, ISSUES.md |

## Défauts trouvés et corrigés pendant la QA
Voir ISSUES.md (6 défauts, dont 3 de sévérité haute, tous corrigés et couverts par des tests).

## Orchestration (§16, métriques réelles uniquement)
- Agents invoqués : **0 sous-agent** ; tout réalisé par l'orchestrateur dans une session (D13). Pic de parallélisme : 1 agent + exécution en arrière-plan des tests navigateur.
- Tâches réouvertes : 2 (équilibrage, puis 2 bugs UI trouvés par l'e2e).
- Tokens par tâche : non observables dans cet environnement.

## Prochaine itération proposée
Reprise d'expédition, test appareils réels, musiques par biome, mode difficulté, publication GitHub Pages (sur accord).
