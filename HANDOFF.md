# HANDOFF : reprise rapide

- Branche : `claude/new-session-ka1x9y`. Dernier commit : `03fdd12` (équilibrage H2). Vérifications complètes relancées après ce commit : toutes vertes.
- Relancer : `npm install && npm run build && npm test && npm run test:e2e`
- Jouer en local : `npm run dev` puis http://localhost:5173 (crochets de test : ajouter `?test`).
- Reprise d'expédition : la phase en cours est sauvegardée (`convoy-zero.run`) ; le menu affiche « Reprendre l'expédition ».
- Agents : les rôles `.claude/agents/` (cz-dev, cz-auditor, cz-tester, cz-memory) ne sont pas chargés dans la session qui les a créés. Ils seront utilisables dès la prochaine session via `subagent_type`. Repli D14 si besoin.

## Prochaines 3 actions
1. Tester sur appareils réels (Android Chrome, iPhone Safari) : FPS, son, veille, reprise.
2. Test sur vrais appareils (Android Chrome, iPhone Safari) : FPS, son, mise en veille, reprise.
3. Ferraille excédentaire et boss : mesurer FIELD_HP_PER_SCRAP avec `npx vite-node scripts/balance.ts 30 0`, puis retours de joueurs humains avant toute modification du boss.

Restent ouverts (ISSUES.md) : focus après re-rendu, toast de carte sur mobile.

## Risques / non couvert
- Performances réelles sur mobile bas de gamme non mesurées (environnement sans GPU).
- Safari iOS non testé (Chromium uniquement).
- Reprise testée seulement en phase conduite.
- Publication GitHub Pages (`dist/`, base `./`) : sur décision de l'utilisateur uniquement.
