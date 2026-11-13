# Mesures de l'usine multiagents — CONVOY ZERO

Phase 1 (V1, avant correction) : 0 sous-agent, tout par l'orchestrateur (Opus).

## Capacités vérifiées (13/11/2026)
- Outil Agent : disponible, modèles `sonnet` / `haiku` / `opus`.
- Définitions `.claude/agents/*.md` créées en cours de session : **non chargées** (`Agent type 'cz-auditor' not found`). Actives à la prochaine session.
- Repli : agent `general-purpose` + `model` forcé + rôle lu depuis `.claude/agents/<rôle>.md`.
- Isolation : même dépôt, propriété stricte des fichiers ; e2e et port 4173 réservés à l'orchestrateur.

## Vague 2 — lancée en parallèle (pic : 7 agents)
| id | modèle | rôle | mission | fichiers | statut |
|---|---|---|---|---|---|
| S1 | sonnet | cz-dev | perf rendu (pooling, nuit) | src/scenes/DriveScene.ts | ✅ accepté : nuit ×2 à ×4 (2,5–5 → 9–10 FPS SwiftShader, même charge) ; capture revue par l'orchestrateur · 87 k tokens · 13 outils · 355 s |
| S2 | sonnet | cz-dev | reprise d'expédition | src/game/runSave.ts, src/ui/app.ts, tests/unit/runSave.test.ts | ✅ accepté (186 tests revérifiés) ; faille « rechargement après défaite » corrigée par l'orchestrateur · 113 k tokens · 17 outils · 141 s |
| S3 | sonnet | cz-dev | audio par biome + moteur | src/audio/audio.ts | ✅ livré (tsc/vitest/build OK, test de fumée Node ; son non écouté) — setBiome intégré par l'orchestrateur · 80 k tokens · 7 outils · 97 s |
| H1 | haiku | cz-auditor | audit a11y/ergonomie UI | docs/audits/ui-a11y.md | ✅ 12 constats (2 hauts confirmés par l'orchestrateur) · 121 k tokens · 13 outils · 104 s |
| H2 | haiku | cz-auditor | audit équilibrage | docs/audits/balance.md | ✅ 400 runs/niveau ; 2 recommandations appliquées par l'orchestrateur (coûts méta ×1,5, pompe 12→16) · 156 k tokens · 34 outils · 1302 s |
| H3 | haiku | cz-tester | tests cas limites | tests/unit/edge.test.ts | ✅ accepté — 47 tests, 0 bug trouvé ; revérifié par l orchestrateur · 102 k tokens · 15 outils · 77 s |
| H4 | haiku | cz-auditor | revue bugs simulation | docs/audits/sim-review.md | ✅ 8 constats dont 2 hauts confirmés par l'orchestrateur (réapparition boss, pas de temps 120 Hz) · 129 k tokens · 14 outils · 196 s |
| H5 | haiku | cz-dev (micro) | correctifs a11y hors app.ts | styles.css, index.html, icons.ts | ✅ accepté (capture mobile revérifiée par l'orchestrateur) · 93 k tokens · 19 outils · 94 s |
| H6 | haiku | cz-dev (micro) | correctifs a11y app.ts | src/ui/app.ts | ✅ accepté (clavier, dialogue, focus vérifiés en navigateur par l'orchestrateur) · 118 k tokens · 12 outils · 89 s |
| S4 | sonnet | cz-dev | correctifs simulation (audit H4) | src/game/sim/sim.ts, tests/unit/simfix.test.ts | ✅ accepté : 196 tests + scripts de preuve de H4 relancés par l'orchestrateur, bugs disparus ; équilibrage inchangé (42,5 %) · 93 k tokens · 8 outils · 105 s |
| H7 | haiku | cz-tester | vérification indépendante (build, unitaires, e2e, captures, reprise) | docs/audits/verification.md | ✅ build OK · 196/196 unitaires · 16 e2e passés, 0 échec · reprise OK ; point boss complété par l'orchestrateur · 112 k tokens · 48 outils · 343 s |

## Incidents de coordination
- H7 : rapport final renvoyé 4 fois à l'identique (tâche d'arrière-plan résiduelle qui le relançait) → arrêté par l'orchestrateur (TaskStop). Coût : ~5 k tokens et du bruit, aucun impact sur le code.
- Définitions `.claude/agents/` non chargées en cours de session → repli `general-purpose` + modèle forcé.
- Ports : un agent (H5) a trouvé 4175 occupé par S1 et s'est replié sur 4176 sans conflit — l'attribution de ports par mission a fonctionné.
| M1 | haiku | cz-memory | checkpoint mémoire (7 documents) | STATE, TASKS, ISSUES, DECISIONS, HANDOFF, RAPPORT, README | ✅ accepté avec corrections de l'orchestrateur (règle D16 mal retranscrite, chiffres non remesurés remplacés par mesures) · 112 k tokens · 10 outils · 93 s |

## Bilan vague 2
- 12 agents lancés (4 Sonnet, 8 Haiku), pic de parallélisme 7. 12/12 livrables acceptés ; 5 ont nécessité un complément de l'orchestrateur (S2 faille, S3 branchement, H7 point boss, M1 corrections, H2 décisions).
- Défauts trouvés par des agents et absents des tests existants : 8 (simulation) + 12 (accessibilité) + 2 bugs UI ; 0 par H3 (tests de cas limites).
- Coût cumulé ≈ 1,3 M tokens de sous-agents (somme des valeurs rapportées par le runtime).
