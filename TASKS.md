# TASKS

Ownership : orchestrateur (Claude Code, session unique). Agents spécialisés : voir docs/AGENT_METRICS.md.

## Terminées
- Vague 1 : T01 Scaffold Vite/TS/Phaser/Vitest/Playwright · T02 RNG + carte reproductible · T03 Run/ressources/règles de secours
- T04 10 événements · T05 14 upgrades run + 6 méta · T06 Sauvegarde versionnée + migration
- T07 Simulation · T08 Équilibrage headless · T09 Textures procédurales · T10 Rendu + VFX + nuit · T11 Audio procédural
- T12 UI · T13 Contrôles clavier/tactile, pause, retour navigateur, onglet masqué
- T14 Tests unitaires · T15 Tests e2e desktop + mobile · T16 Captures · T17 Docs
- Vague 2 (11 agents, 11 livrées, 0 réouverte) : reprise d'expédition · audio par biome + moteur · rendu optimisé · audits a11y, simulation, équilibrage · correctifs a11y et simulation · tests cas limites (47) · vérification indépendante

## Backlog (prochaine itération)
- Tester la reprise d'expédition après segment (événement, récompense, atelier, camp) : seule la phase conduite est couverte.
- Ferraille excédentaire : mesurer FIELD_HP_PER_SCRAP (réparation de terrain) avec `scripts/balance.ts`.
- Boss final : décision après retours de joueurs humains (pilote auto non représentatif).
- Restaurer le focus clavier après re-rendu (audit H1 #3).
- Toast de la carte qui couvre un nœud 3 s sur mobile.
- Écoute audio réelle ; sons plus riches.
- Relancer build, unitaires et e2e après 03fdd12.
- Réglage de difficulté, statistiques détaillées de profil, vibrations mobiles, plein écran.
