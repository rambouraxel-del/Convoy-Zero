# STATE

Mise à jour : 13/11/2026, après la vague 2 multiagents. HEAD `03fdd12` (branche `claude/new-session-ka1x9y`).

- Build : ✅ `npm run build` · Unitaires : ✅ 196/196 · E2E : ✅ 16 passés, 0 échec, 2 ignorés par conception (clavier sur mobile, tactile sur desktop).
- ✅ Revérifié par l'orchestrateur après `03fdd12` : build OK, 196/196 unitaires, 16 e2e passés (2 ignorés par conception).
- Équilibrage (audit H2, pilote auto, N=400, méta uniforme) : niveau 0 41,3 % ; niveau 1 74,8 % ; niveau 2 89,8 % ; niveau 3 98,0 %. Après correctifs S4 : niveau 0 à 42,5 %. Le boss final cause 58 à 68 % des défaites. Arbre méta : 487 pièces, 6,6 expéditions avant ×1,5 → **9,7 après** (médiane 10, P90 11, 100 essais, remesuré).
- Performance : simulation 0,014 ms/pas ; mémoire stable sur 7 segments ; FPS headless SwiftShader (rendu logiciel, sans GPU) non représentatif. Nuit ×2 à ×4 après optimisation de rendu (9–10 FPS en SwiftShader, même charge).

| Module | Fichiers | Statut |
|---|---|---|
| Données/équilibrage | src/config/balance.ts, src/game/upgrades.ts, src/game/events.ts | ✅ H2 appliqué (×1,5 méta, pompe 16) — à remesurer |
| Carte procédurale | src/game/mapgen.ts | ✅ testé |
| Run, ressources, secours | src/game/run.ts | ✅ testé |
| Événements (10) | src/game/events.ts | ✅ testé |
| Améliorations (14 + 6) | src/game/upgrades.ts | ✅ testé |
| Sauvegarde v2 | src/game/save.ts | ✅ testé |
| Reprise d'expédition | src/game/runSave.ts, src/ui/app.ts | ✅ 9 tests unitaires ; e2e en phase conduite seulement |
| Simulation | src/game/sim/sim.ts | ✅ testé (audit H4, 6 correctifs S4) |
| Rendu/VFX | src/scenes/DriveScene.ts, src/render/textures.ts | ✅ pooling, obscurité demi-résolution ; captures |
| Audio | src/audio/audio.ts | ✅ audio par biome + moteur (`setBiome`) ; non écouté en headless |
| Accessibilité | src/ui/app.ts, styles.css, index.html, icons.ts | ✅ clavier, dialogues, aria-live, contraste, reduced-motion, zoom ; focus après re-rendu ouvert |
| UI/flux | src/ui/* | ✅ e2e |
