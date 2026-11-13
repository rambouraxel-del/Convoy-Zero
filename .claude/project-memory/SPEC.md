# SPEC — résumé des exigences verrouillées
Référence complète : `docs/CONVOY_ZERO_CAHIER_DES_CHARGES.md` (V1.0, 13/11/2026).

- 2D vue du dessus, illustration moderne (pas de pixel art, pas de 3D). Palette sable/rouille/asphalte + turquoise/bleu pétrole.
- Équilibre gestion / exploration / combat. Roguelite : run réinitialisée, méta-progression persistante.
- Mini-jeu complet : menus, sauvegarde, tutoriel, audio, écran de fin.
- Conduite hybride : auto par défaut, manuel (clavier/joystick) temporaire, retour facile en auto. Tirs automatiques.
- Convoi : Commandement (perte = défaite), Escorte (tir rapide), Récupérateur (ramassage).
- 5 ennemis (Maraudeur, Tireur, Éclaireur, Blindé, Kamikaze) + rencontre finale renforcée.
- Carte à embranchements par graine, 5–7 étapes + finale. 3 biomes (désert, industriel, nuit) avec risque distinct.
- ≥ 8 événements, 12 upgrades de run, 6 upgrades permanentes, monnaie « pièces de convoi ».
- Ressources : carburant, ferraille, provisions ; jamais négatives ; pas de softlock.
- Web responsive PC + mobile (paysage), sans serveur ; Phaser + TS + Vite ; Vitest + Playwright.
- LocalStorage versionné ; pas de compte, backend, pub, achat intégré, déploiement public sans accord.
