# DÉCISIONS

| # | Décision | Raison | Conséquence |
|---|---|---|---|
| D1 | Phaser 3.90 + TS 5.8 + Vite 6 + Vitest 3 + Playwright 1.63 (versions figées) | API Phaser 3 stable et maîtrisée ; Playwright = navigateur préinstallé | Phaser 4 non retenu (risque d'API) |
| D2 | Simulation pure (`src/game/sim/sim.ts`) séparée du rendu | testable sans navigateur, déterministe, équilibrage headless | Phaser ne fait que dessiner |
| D3 | UI en DOM/CSS au-dessus du canvas | lisibilité, cibles tactiles ≥ 44 px, accessibilité, tests e2e simples | HUD hors canvas |
| D4 | Défilement horizontal (convoi vers la droite), orientation **paysage** | adapté à l'écran paysage | message « tournez le téléphone » en portrait étroit (contournable) |
| D5 | Textures dessinées au Canvas 2D au démarrage | aucun asset externe, aucune licence | style vectoriel net |
| D6 | Audio 100 % Web Audio procédural (SFX + musique générative, par biome) | aucune licence, aucun chargement | sonorité synthétique assumée |
| D7 | Reprise d'expédition (V2) : la phase en cours est sauvegardée. Supersède l'ancienne règle « pas de reprise » | demande de la vague 2 (`runSave.ts`) | défaite = sauvegarde effacée ; rechargement après défaite interdit de rejouer le segment |
| D8 | Règles anti-blocage : carburant manquant → ferraille (2/u) puis coque (3 PV/u, jamais mortel) ; famine → −12 % PV (non mortel) ; chaque événement a un choix gratuit | spec « aucun softlock » | testé (`run.test.ts`) |
| D9 | Réparation de fortune sur la carte (2 PV/ferraille) en plus de l'atelier (4 PV/ferraille) | équilibrage : sans elle, 0 % de victoires | la ferraille a un usage constant |
| D10 | Onglet masqué → pause automatique + audio suspendu | « vitesse correcte en arrière-plan » : pas de rattrapage brutal | dt borné à 50 ms |
| D11 | Crochets de test `window.__CZ` actifs seulement avec `?test` | e2e rapides et fiables | pas de triche en usage normal |
| D12 | 14 upgrades de run (≥ 12 demandées), 10 événements (≥ 8) | marge de variété | — |
| D13 | Pas de sous-agents pour l'écriture du code en V1 | contexte partagé fort, coût d'initialisation > gain sur ce volume | partiellement remplacée : vague 2 avec 11 agents (D14, D15) |
| D14 | Repli agents génériques : les rôles `.claude/agents/` créés en session ne sont pas chargés (`Agent type not found`). Agent `general-purpose`, modèle forcé, rôle lu depuis `.claude/agents/<rôle>.md` | constat de la vague 2 | rôles utilisables à la prochaine session via `subagent_type` |
| D15 | Propriété stricte des fichiers par agent ; ports dédiés par mission ; e2e et port 4173 réservés à l'orchestrateur | éviter les conflits d'écriture et de serveur (un agent a dû passer de 4175 à 4176) | agents de code et de test ne lancent pas la suite e2e |
| D16 | Règles de la simulation (S4) : boss apparu une seule fois ; pas de temps fixe avec accumulateur ; un kill et son butin ne comptent que si le joueur tue ; ennemis hors champ retirés ; bouclier = invulnérabilité 0,35 s. Les explosions (barils, mines, souffle secondaire) respectent l'invulnérabilité ; seule l'explosion télégraphiée d'un kamikaze ennemi l'ignore | audit H4 : 6 correctifs vérifiés par scripts de preuve | 196 tests unitaires ; équilibrage inchangé (42,5 %) |
| D17 | Équilibrage H2 : coûts méta ×1,5 (objectif ~10 expéditions pour tout débloquer, au lieu de 6,6) ; pompe manuelle 12 → 16 carburant. Boss inchangé (R1 non appliquée) | audit H2 : arbre entièrement acheté en 6,6 expéditions ; pilote auto à 41 % sur le boss, un humain esquive | remesuré : 9,7 expéditions (médiane 10) ; tests verts |
