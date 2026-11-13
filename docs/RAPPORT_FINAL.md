# Rapport final — CONVOY ZERO V1.0

## Critères de recette (cahier des charges §14)

| Critère | État | Preuve |
|---|---|---|
| `npm install`, `npm run build`, `npm test` | ✅ | build Vite OK, 196 tests Vitest (revérifiés après l'équilibrage final) |
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

Source : docs/AGENT_METRICS.md.
- Phase 1 (V1) : 0 sous-agent, tout par l'orchestrateur (D13).
- Vague 2 : **11 agents** (4 Sonnet pour le code, 7 Haiku pour les audits, tests et micro-corrections). **Pic de parallélisme : 7 agents.**
- Tâches : 11 livrées, 11 acceptées par l'orchestrateur ; **0 réouverte** en vague 2 (2 réouvertures en phase 1).
- Tokens cumulés (somme des valeurs par agent, non mesure de session) : ≈ 1,20 M. Outils : 200. Durée cumulée des agents : ≈ 2 900 s (le temps réel est plus court, les agents tournant en parallèle).
- Incident : un renvoi de rapport répété 4 fois (tâche d'arrière-plan résiduelle), arrêté par l'orchestrateur ; coût ≈ 5 k tokens, sans effet sur le code.
- Limite : les rôles `.claude/agents/` n'ont pas été chargés dans la session (repli D14) ; ils le seront à la prochaine session.

## Prochaine itération proposée
Test appareils réels, reprise après segment (événement, atelier, camp), ferraille excédentaire, mode difficulté, publication GitHub Pages (sur accord).
