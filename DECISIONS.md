# DÉCISIONS

| # | Décision | Raison | Conséquence |
|---|---|---|---|
| D1 | Phaser 3.90 + TS 5.8 + Vite 6 + Vitest 3 + Playwright 1.63 (versions figées) | API Phaser 3 stable et maîtrisée ; Playwright = navigateur préinstallé | Phaser 4 non retenu (risque d'API) |
| D2 | Simulation pure (`src/game/sim/sim.ts`) séparée du rendu | testable sans navigateur, déterministe, équilibrage headless | Phaser ne fait que dessiner |
| D3 | UI en DOM/CSS au-dessus du canvas | lisibilité, cibles tactiles ≥ 44 px, accessibilité, tests e2e simples | HUD hors canvas |
| D4 | Défilement horizontal (convoi vers la droite), orientation **paysage** | adapté à l'écran paysage | message « tournez le téléphone » en portrait étroit (contournable) |
| D5 | Textures dessinées au Canvas 2D au démarrage | aucun asset externe, aucune licence | style vectoriel net |
| D6 | Audio 100 % Web Audio procédural (SFX + musique générative) | aucune licence, aucun chargement | sonorité synthétique assumée |
| D7 | Pas de reprise en milieu d'expédition (V1) | facultatif dans la spec | annoncé dans l'aide, la pause et l'abandon |
| D8 | Règles anti-blocage : carburant manquant → ferraille (2/u) puis coque (3 PV/u, jamais mortel) ; famine → −12 % PV (non mortel) ; chaque événement a un choix gratuit | spec « aucun softlock » | testé (`run.test.ts`) |
| D9 | Réparation de fortune sur la carte (2 PV/ferraille) en plus de l'atelier (4 PV/ferraille) | équilibrage : sans elle, 0 % de victoires | la ferraille a un usage constant |
| D10 | Onglet masqué → pause automatique + audio suspendu | « vitesse correcte en arrière-plan » : pas de rattrapage brutal | dt borné à 50 ms |
| D11 | Crochets de test `window.__CZ` actifs seulement avec `?test` | e2e rapides et fiables | pas de triche en usage normal |
| D12 | 14 upgrades de run (≥ 12 demandées), 10 événements (≥ 8) | marge de variété | — |
| D13 | Pas de sous-agents pour l'écriture du code | contexte partagé fort, coût d'initialisation > gain sur ce volume | voir rapport final |
