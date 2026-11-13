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
| S1 | sonnet | cz-dev | perf rendu (pooling, nuit) | src/scenes/DriveScene.ts | en cours |
| S2 | sonnet | cz-dev | reprise d'expédition | src/game/runSave.ts, src/ui/app.ts, tests/unit/runSave.test.ts | en cours |
| S3 | sonnet | cz-dev | audio par biome + moteur | src/audio/audio.ts | ✅ livré (tsc/vitest/build OK, test de fumée Node ; son non écouté) — intégration setBiome en attente de app.ts · 80 k tokens · 7 outils · 97 s |
| H1 | haiku | cz-auditor | audit a11y/ergonomie UI | docs/audits/ui-a11y.md | ✅ 12 constats (2 hauts confirmés par l'orchestrateur) · 121 k tokens · 13 outils · 104 s |
| H2 | haiku | cz-auditor | audit équilibrage | docs/audits/balance.md | en cours |
| H3 | haiku | cz-tester | tests cas limites | tests/unit/edge.test.ts | ✅ accepté — 47 tests, 0 bug trouvé ; revérifié par l orchestrateur · 102 k tokens · 15 outils · 77 s |
| H4 | haiku | cz-auditor | revue bugs simulation | docs/audits/sim-review.md | en cours |
| H5 | haiku | cz-dev (micro) | correctifs a11y hors app.ts | styles.css, index.html, icons.ts | en cours |
