# STATE

- Build : ✅ `npm run build` · Unitaires : ✅ 130/130 · E2E : ✅ 16 passés, 2 ignorés par conception (clavier sur mobile, tactile sur desktop).
- Équilibrage (pilote auto, sans méta, 30 graines) : 40 % de victoires ; méta niv. 1 : ~77 % ; méta max : ~93 %. Run complète ≈ 4 min de route + choix ≈ 6–9 min.
- Performance : simulation 0,014 ms/pas ; mémoire stable sur 7 segments (27→29 Mo) ; FPS headless SwiftShader 16–31 (rendu logiciel, pas de GPU) — non représentatif d'un vrai appareil.

| Module | Fichiers | Statut |
|---|---|---|
| Données/équilibrage | src/config/balance.ts | ✅ |
| Carte procédurale | src/game/mapgen.ts | ✅ testé |
| Run, ressources, secours | src/game/run.ts | ✅ testé |
| Événements (10) | src/game/events.ts | ✅ testé |
| Améliorations (14 + 6) | src/game/upgrades.ts | ✅ testé |
| Sauvegarde v2 | src/game/save.ts | ✅ testé |
| Simulation | src/game/sim/sim.ts | ✅ testé |
| Rendu/VFX | src/scenes/DriveScene.ts, src/render/textures.ts | ✅ captures |
| Audio | src/audio/audio.ts | ✅ (non écouté en headless) |
| UI/flux | src/ui/* | ✅ e2e |
