# HANDOFF — reprise rapide

- Branche : `claude/new-session-ka1x9y` (dernier commit = livraison V1). Tous les critères de recette couverts (voir docs/RAPPORT_FINAL.md).
- Relancer : `npm install && npm run build && npm test && npm run test:e2e`
- Jouer en local : `npm run dev` puis http://localhost:5173 (crochets de test : ajouter `?test`).

## Prochaines 3 actions
1. Test sur vrais appareils (Android Chrome, iPhone Safari) : FPS, son, mise en veille.
2. Retours joueurs → ajuster `src/config/balance.ts` (vérifier avec `npx vite-node scripts/balance.ts 30 0`).
3. Publication GitHub Pages (`dist/`, base `./`) — **sur décision de l'utilisateur uniquement**.

## Risques / non couvert
- Performances réelles sur mobile bas de gamme non mesurées (environnement sans GPU).
- Safari iOS non testé (Chromium uniquement).
- Pas de reprise d'expédition en cours (V1, annoncé en jeu).
