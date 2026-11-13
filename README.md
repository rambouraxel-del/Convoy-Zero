# CONVOY ZERO

Roguelite de convoi post-apocalyptique en **2D vue du dessus**, jouable dans le navigateur sur **PC et mobile (paysage)**.
Menez le Mastodonte et ses deux escortes à travers 6 étapes (désert, zone industrielle, terres mortes de nuit) jusqu'à l'embuscade finale du Béhémoth.

Studio : Azerya Studio · V1.0 · Spécification : [`docs/CONVOY_ZERO_CAHIER_DES_CHARGES.md`](docs/CONVOY_ZERO_CAHIER_DES_CHARGES.md)

## Lancer

```bash
npm install
npm run dev          # développement → http://localhost:5173
npm run build        # build de production → dist/
npm run preview      # sert dist/ sur http://localhost:4173
npm test             # tests unitaires (Vitest)
npm run test:e2e     # tests navigateur Playwright desktop + mobile (lance preview, nécessite un build)
```

`dist/` est statique (base `./`) : déployable tel quel sur **GitHub Pages** (sous-dossier) ou **Vercel** (aucun serveur requis).
Équilibrage headless : `npx vite-node scripts/balance.ts 30 0` (30 expéditions en pilote auto, méta niveau 0).

## Commandes

| Action | Clavier | Mobile |
|---|---|---|
| Prendre le volant | Flèches ou WASD (= ZQSD en AZERTY) | Joystick (bas gauche) |
| Basculer AUTO / MANUEL | Espace ou bouton | Bouton de mode (bas droite) |
| Pause | Échap, P ou bouton ❚❚ | Bouton ❚❚ ou retour du téléphone |

Option « Maintien » (Paramètres) : manuel seulement tant qu'une direction est tenue.
Les tirs sont automatiques (priorité : kamikazes amorcés, tireurs qui visent, puis le plus proche).

## Fonctionnement

- **Boucle** : Garage (méta) → carte à embranchements (graine reproductible) → segment de convoi → événement / atelier / camp / butin → … → finale → bilan → garage.
- **Convoi** : Mastodonte (commandement, canon lourd, sa perte = défaite), Lame (mitrailleuse rapide), Glaneur (aimant large, +40 % ferraille). Dégâts persistants pendant l'expédition.
- **Ennemis** : Maraudeur, Tireur, Éclaireur, Blindé, Kamikaze + Béhémoth (boss, renforts, tir en éventail télégraphié).
- **Biomes** : désert (rafales de sable), industriel (barils explosifs, épaves), nuit (obscurité + phares, mines).
- **Ressources** : carburant (par étape), ferraille (réparations/achats), provisions (2 par étape). Jamais négatives. Règles de secours anti-blocage annoncées en jeu.
- **Contenu** : 10 événements, 14 améliorations de run, 6 améliorations permanentes (3 niveaux), monnaie « pièces de convoi ».
- **Sauvegarde** : LocalStorage versionné (`convoy-zero.save`, v2, migration v1, données corrompues gérées).

### Reprise d'expédition

- La phase en cours (carte, conduite, événement, atelier, camp) est sauvegardée dans `convoy-zero.run`. Le menu affiche alors « Reprendre l'expédition ».
- La reprise restaure le nœud et les ressources au moment de la sauvegarde. Le carburant déjà payé n'est pas débité une seconde fois.
- Une défaite efface la sauvegarde de reprise : recharger après une défaite ne permet pas de rejouer le segment perdu. Les pièces de convoi sont perdues si le rechargement intervient moins de 1,4 s après la défaite.
- Limite : la reprise est testée en phase de conduite ; les autres phases le sont par le code.

## Architecture

```
src/
  config/balance.ts     valeurs d'équilibrage centralisées
  core/                 types, RNG reproductible
  game/                 logique pure : carte, run, événements, améliorations, sauvegarde
  game/sim/sim.ts       simulation déterministe d'un segment (ennemis, tirs, IA de conduite)
  scenes/DriveScene.ts  rendu Phaser + VFX (lit la simulation)
  render/textures.ts    textures procédurales (Canvas 2D)
  audio/audio.ts        SFX et musique générative (Web Audio)
  ui/                   écrans DOM/CSS, HUD, joystick
tests/unit              Vitest (196 tests)   tests/e2e   Playwright (desktop + mobile)
```

## Attribution des assets

Aucun asset externe : graphismes dessinés par code (Canvas 2D), sons et musique synthétisés (Web Audio API), polices système. Seule dépendance d'exécution : [Phaser 3](https://phaser.io) (licence MIT).

## Limitations connues

Voir [`ISSUES.md`](ISSUES.md) et le rapport [`docs/RAPPORT_FINAL.md`](docs/RAPPORT_FINAL.md).
