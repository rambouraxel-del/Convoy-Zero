# Vérification indépendante H7 — CONVOY ZERO

Dépôt : /home/user/Convoy-Zero · HEAD `e6326f7` · Testeur : cz-tester (Haiku)
Aucun fichier de src/ ni de tests/ modifié. Aucun commit, aucun push.

## Verdict synthétique

| # | Point | Verdict |
|---|-------|---------|
| 1 | `npm run build` | OK |
| 2 | `npx vitest run` | OK (196/196) |
| 3 | `npx playwright test --trace off` | OK (16 passés, 0 échec, 2 ignorés attendus) |
| 4a | desktop/07-nuit.png | OK |
| 4b | desktop/08-boss.png | OK partiel : Béhémoth et halo visibles ; lignes de visée rouges NON VÉRIFIÉES sur cette image |
| 4c | mobile/04-desert.png | OK |
| 4d | mobile/03-carte.png | OK avec réserve cosmétique (bulle de message sur un nœud) |
| 4e | mobile/01-menu.png | OK (bouton « Reprendre » absent, cohérent : profil vierge) |
| 5 | Reprise d'expédition (script) | OK |

## 1. Build

Commande : `npm run build` (tsc --noEmit && vite build). Sortie : exit 0.
```
✓ 23 modules transformed.
dist/index.html 0.90 kB
dist/assets/index-My3SO21M.css 14.00 kB
dist/assets/index--fj93wTh.js 1,605.64 kB (gzip 381.17 kB)
✓ built in 5.43s
```
Verdict : OK. Note : le bundle JS dépasse 500 kB (avertissement de taille, pas une erreur).

## 2. Vitest (unitaires)

Commande : `npx vitest run`. Journal : /tmp/claude-0/h7/vitest.log. Exit 0.
```
Test Files  7 passed (7)
Tests       196 passed (196)
```
Fichiers : run.test.ts (29), edge.test.ts (47), simfix.test.ts (10), core.test.ts (76), runSave.test.ts (9), save.test.ts (6), sim.test.ts (19).
Verdict : OK. Aucun échec.

## 3. Playwright (desktop + mobile)

Commande : `npx playwright test --trace off`, serveur `npm run preview` (port 4173). Journal : /tmp/claude-0/h7/e2e.log.
```
16 passed (3.4m)
2 skipped
0 failed
```
Détail :
- desktop : parcours complet OK, défaite OK, pilotage auto/manuel OK, pause OK, paramètres audio OK, cibles tactiles OK, sauvegarde corrompue OK, captures d'écran OK ; « pilotage tactile » SKIP (game.spec.ts:72, `test.skip(project !== 'mobile')`, voulu).
- mobile : parcours complet OK, défaite OK, joystick/tactile OK, pause OK, paramètres OK, cibles tactiles OK, sauvegarde corrompue OK, captures d'écran OK ; « pilotage clavier » SKIP (game.spec.ts:55, `test.skip(project === 'mobile')`, voulu).

Aucun échec, donc pas d'erreur à analyser. Les deux SKIP sont conditionnés par le projet dans le code, pas par un test désactivé.

## 4. Captures régénérées (docs/screenshots/)

Les captures ont été régénérées par screens.spec.ts pendant le run (desktop 17:19, mobile ~17:20–17:21).

**desktop/07-nuit.png : OK.** Scène nocturne sombre. Les phares des véhicules (Mastodonte, Lame, Glaneur) sont visibles sous forme de cônes de lumière. HUD lisible (carburant 22, ferraille 20, vivres 4 ; barre de route 11 % ; état des véhicules à droite), sans chevauchement. Bouton AUTO visible en bas à droite.

**desktop/08-boss.png : OK partiel.** Barre de vie « BÉHÉMOTH » en haut, centrée, lisible. Le Béhémoth est visible à droite (carrosserie rouge, crâne, deux canons), avec un halo sombre autour (diffus, peu contrasté). Des points lumineux rouges/orangés (projectiles ou tirs) sont visibles près du convoi. **Les lignes de visée rouges du Béhémoth ne sont pas identifiables sur cette image** (recadrage vérifié) : NON VÉRIFIÉ pour ce point précis. HUD sans chevauchement.

**mobile/04-desert.png : OK.** Une ligne de visée rouge pointillée part d'un ennemi à droite vers le convoi. HUD (carburant 41, ferraille 20, vivres 8), jauges des véhicules, joystick à gauche, bouton AUTO à droite, bannière d'aide en bas : lisibles, sans chevauchement notable.

**mobile/03-carte.png : OK avec réserve cosmétique.** Carte en trois biomes lisible, nœud accessible mis en évidence, panneau latéral (convoi, PV, améliorations) lisible. Réserve : la bulle « Expédition DUNE-42 : bonne route. » recouvre partiellement un nœud du biome central en haut. Cosmétique, pas bloquant.

**mobile/01-menu.png : OK.** Titre, boutons JOUER / GARAGE / COMMENT JOUER / PARAMÈTRES, pied de page de stats : cohérents, pas de débordement. Le bouton « Reprendre l'expédition » est absent, ce qui est cohérent avec un profil vierge (aucune sauvegarde). Sa présence réelle est vérifiée par le point 5, pas par la capture.

**desktop/01-menu.png** : même constat que mobile, OK.

## 5. Reprise d'expédition (script scripté)

Script : /tmp/claude-0/h7/resume.cjs (Playwright chromium, `?test`, contexte neuf). Journal de sortie brut :
```
screen_after_play "map"
chosen_node "n0_0"
before_reload {"screen":"drive","currentId":"n0_0","fuel":40,"food":8,"scrap":20,"outcome":null}
menu_resume_button_count 1
after_resume {"screen":"drive","currentId":"n0_0","fuel":40,"food":8,"scrap":20,"outcome":null}
same_node true
fuel_not_repaid true
fuel_equal true
console_errors []
```
Ce qui est vérifié :
- Jouer → nœud accessible `n0_0` → Partir → 1 s de conduite → rechargement : OK.
- Le menu affiche `[data-act=resume-run]` (1 occurrence) : OK.
- Clic sur Reprendre : screen = `drive`, currentId = `n0_0` (identique au nœud choisi) : OK.
- Carburant identique avant et après reprise (40 = 40) : pas de repaiement. OK. Note : le carburant est débité au départ (travelTo) avant la sauvegarde, donc la comparaison porte bien sur la valeur sauvegardée.
- Aucune erreur console ni exception de page.

Verdict : OK.

Limite : le script ne couvre que la reprise en phase de conduite (saveRun('drive')), pas les reprises en phase post-segment (événement, récompense, atelier, camp).

## Anomalies relevées (aucune corrigée)

1. Béhémoth (desktop/08-boss.png) : lignes de visée rouges non identifiables sur la capture ; à confirmer en visuel dédié si c'est un point d'acceptation.
2. Carte mobile : bulle de message qui recouvre un nœud (cosmétique).
3. Bundle JS de 1,6 MB (avertissement vite, pas bloquant).

Aucune erreur fonctionnelle détectée.
