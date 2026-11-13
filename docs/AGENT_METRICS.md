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
| S3 | sonnet | cz-dev | audio par biome + moteur | src/audio/audio.ts | en cours |
| H1 | haiku | cz-auditor | audit a11y/ergonomie UI | docs/audits/ui-a11y.md | en cours |
| H2 | haiku | cz-auditor | audit équilibrage | docs/audits/balance.md | en cours |
| H3 | haiku | cz-tester | tests cas limites | tests/unit/edge.test.ts | en cours |
| H4 | haiku | cz-auditor | revue bugs simulation | docs/audits/sim-review.md | en cours |
