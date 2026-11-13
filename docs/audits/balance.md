# Audit H2 : équilibrage et économie de CONVOY ZERO

Auditeur : cz-auditor (lecture seule sur le code source). Aucun fichier source modifié. Scripts d'analyse dans `/tmp/claude-0/h2/`.

## Méthode et limites

- **Joueur automatique** : `tests/unit/autoplay.ts`. Ce n'est pas un joueur humain. Il prend toujours la route la moins chère, répare sous 75 % de PV, achète 4 améliorations seulement en atelier, et choisit pour chaque événement le **premier choix abordable** (`tests/unit/autoplay.ts:38`). Tous les chiffres ci-dessous décrivent ce bot, pas des joueurs.
- **Taux de victoire** : `scripts/balance.ts` (N=50, niveau méta uniforme) est donné tel quel. Un N=50 a un IC 95 % de ±14 points autour de 44 %, donc les mesures à N=400 sont plus fiables. Le harnais N=400 a été vérifié contre `autoplay` sur les mêmes graines (53/120 victoires dans les deux cas à niveau 0).
- **Choix d'événement** : test forcé sur 300 graines appariées par événement (même carte, seul le choix change). Taux de base avec la politique par défaut : 44,7 %. Un écart de moins de ~2 points est dans le bruit.
- **Progression méta** : 200 essais, politique d'achat « le moins cher abordable en premier ». Les pièces viennent de `coinsEarned` (`src/game/run.ts:223`), versé aussi en défaite (`src/ui/app.ts:812`).
- **Une première passe** de simulations parallèles a donné une référence de base incohérente (49,3 % au lieu de 44,7 % pour la politique par défaut, et 48 % au lieu de 41 % à niveau 0). Elle a été écartée. Toutes les valeurs ci-dessous viennent de la seconde passe, reproduite et contrôlée.

## 1. Taux de victoire et lieu des défaites

| Niveau méta | `scripts/balance.ts` N=50 | Harnais N=400 | IC 95 % | Défaites dans la finale (boss) | Parties moyennes (étapes / minutes de conduite) |
|---|---|---|---|---|---|
| 0 | 22/50 (44 %) | 165/400 = **41,3 %** | ±4,8 | 137 / 235 (58 %) | 6,04 / 3,7 |
| 1 | 38/50 (76 %) | 299/400 = **74,8 %** | ±4,3 | 69 / 101 (68 %) | 6,63 / 3,9 |
| 2 | 42/50 (84 %) | 359/400 = **89,8 %** | ±3,0 | 27 / 41 (66 %) | 6,85 / 3,9 |
| 3 | 48/50 (96 %) | 392/400 = **98,0 %** | ±1,4 | 5 / 8 (63 %) | 6,97 / 3,9 |

Défaites hors finale à niveau 0 (235 défaites) : `route@5` 48, `route@4` 38, `route@3` 6, embuscade d'événement 4 (étape 4 et 5), événement@5 1, camp@5 1.
Le boss final est le principal mur : 58 à 68 % des défaites à tous les niveaux. Le taux de victoire grimpe vite avec les améliorations, à 98 % au niveau 3, ce qui rend le bot quasi invincible en fin de méta.

## 2. Ressources finales (état à la fin de la partie, N=400)

| Niveau méta | Carburant moy. / méd. (% de parties à 0) | Ferraille moy. / méd. (% à 0 ; % ≥ 10) | Provisions moy. / méd. (% à 0) | Pièces moy. (victoire / défaite) |
|---|---|---|---|---|
| 0 | 17,2 / 17 (5,0 %) | 50,8 / 46 (0 % ; 92,5 %) | 13,4 / 13 (0,3 %) | 59,4 (83,9 / 42,2) |
| 1 | 27,7 / 27 (0 %) | 81,3 / 73 (0 % ; 99 %) | 17,8 / 18 (0 %) | 76,3 (86,4 / 46,3) |
| 2 | 38,8 / 39 (0 %) | 120,9 / 116 (0 % ; 100 %) | 21,6 / 21 (0 %) | 86,1 (90,0 / 52,0) |
| 3 | 50,5 / 50 (0 %) | 167,5 / 169 (0 % ; 100 %) | 25,5 / 25 (0 %) | 94,0 (94,7 / 58,8) |

Lecture : **la ferraille est toujours en excès** (jamais à zéro, médiane 46 à 169 selon le niveau). **Le carburant** est la seule ressource qui s'épuise parfois (5 % des fins de partie à 0 au niveau 0). **Les provisions** sont presque toujours disponibles.

Test de sensibilité sur le sink de ferraille (en mémoire, aucun fichier modifié, niveau 0, N=400) :

| Coût des améliorations d'atelier | Taux de victoire | Ferraille fin moy. / méd. | Améliorations moy. |
|---|---|---|---|
| ×1,0 (actuel) | 41,3 % | 50,8 / 46 | 3,71 |
| ×1,5 | 40,3 % | 51,7 / 46 | 3,58 |

Le coût des améliorations d'atelier ne résorbe pas l'excès de ferraille dans le bot.

## 3. Progression méta : expéditions pour tout acheter

Coût total de toutes les améliorations permanentes : **487 pièces** (`src/game/upgrades.ts:42-47`). Mesures sur 200 essais, achat glouton :

| Coût méta | Coût total | Expéditions moy. | Médiane | P90 | Part de réussite |
|---|---|---|---|---|---|
| ×0,5 | 244 | 3,68 | 4 | 4 | 100 % |
| ×1 (actuel) | 487 | **6,63** | **7** | 7 | 100 % |
| ×2 | 974 | 12,65 | 13 | 14 | 100 % |

Taux de victoire moyen pendant la progression (actuel) : 80,3 %. Une expédition fait en moyenne 3,7 à 3,9 minutes de conduite simulée. L'arbre méta est donc entièrement acheté en environ 7 expéditions, soit moins d'une demi-heure de jeu simulé. C'est très court pour un méta-progrès.

## 4. Valeur espérée des choix d'événement

Colonnes 4 à 9 : valeur analytique (sans simulation) des résultats pondérés par leur probabilité, coût déduit. Dernière colonne : taux de victoire mesuré quand ce choix est forcé (300 graines appariées, base 44,7 %, « applied » = nombre de fois où le choix était abordable et a été pris / nombre de visites).

| Événement | Choix | Coût | Δ carburant (EV net) | Δ ferraille (EV net) | Δ provisions (EV net) | P(embuscade) | P(amélioration) | Δ PV (EV, fraction) | Taux de victoire forcé |
|---|---|---|---|---|---|---|---|---|---|
| station | Siphonner les cuves | aucun | +15 | 0 | 0 | 0 | 0 | -0,025 | 44,7 % (44/44) |
| station | Pompe manuelle | 2 provisions | +12 | 0 | -2 | 0 | 0 | 0 | 44,7 % (44/44) |
| station | Passer son chemin | aucun | 0 | 0 | 0 | 0 | 0 | 0 | 44,7 % (44/44) |
| scrapper | Réparation complète | 15 ferraille | 0 | -15 | 0 | 0 | 0 | +0,35 | 44,7 % (37/39) |
| scrapper | Pièce rare | 18 ferraille | 0 | -18 | 0 | 0 | 1 | 0 | 45,0 % (34/39) |
| scrapper | Passer son chemin | aucun | 0 | 0 | 0 | 0 | 0 | 0 | 43,7 % (39/39) |
| merchant | Acheter carburant | 12 ferraille | +14 | -12 | 0 | 0 | 0 | 0 | 44,7 % (49/50) |
| merchant | Acheter provisions | 10 ferraille | 0 | -10 | +6 | 0 | 0 | 0 | 45,0 % (49/50) |
| merchant | Vendre provisions | 3 provisions | 0 | +12 | -3 | 0 | 0 | 0 | 46,7 % (50/50) |
| merchant | Passer son chemin | aucun | 0 | 0 | 0 | 0 | 0 | 0 | 46,0 % (50/50) |
| camp | Fouiller le camp | aucun | 0 | +7,2 | +3 | 0,4 | 0 | 0 | 44,7 % (51/51) |
| camp | Se reposer et réparer | 2 provisions | 0 | 0 | -2 | 0 | 0 | +0,25 | 44,7 % (51/51) |
| camp | Passer son chemin | aucun | 0 | 0 | 0 | 0 | 0 | 0 | 44,7 % (51/51) |
| wreck | Démonter la carrosserie | 1 provisions | 0 | +14 | -1 | 0 | 0 | 0 | 44,7 % (39/39) |
| wreck | Percer la citerne | aucun | +9 | 0 | 0 | 0 | 0 | 0 | 43,7 % (39/39) |
| wreck | Passer son chemin | aucun | 0 | 0 | 0 | 0 | 0 | 0 | 43,7 % (39/39) |
| minefield | Contourner (dunes) | 6 carburant | -6 | 0 | 0 | 0 | 0 | 0 | 44,7 % (30/30) |
| minefield | Foncer tout droit | aucun | 0 | 0 | 0 | 0 | 0 | -0,07 | 44,0 % (30/30) |
| minefield | Déminer (Glaneur) | 6 ferraille | 0 | +8 | 0 | 0 | 0 | 0 | 44,3 % (30/30) |
| storm | S'abriter | 3 provisions | 0 | 0 | -3 | 0 | 0 | 0 | 44,7 % (33/33) |
| storm | Avancer à l'aveugle | aucun | -2 | +2,5 | 0 | 0 | 0 | -0,10 | 45,3 % (33/33) |
| storm | Contourner | 7 carburant | -7 | 0 | 0 | 0 | 0 | 0 | 44,7 % (33/33) |
| ambush | Combattre | aucun | 0 | +18 | 0 | 1 | 0 | 0 | 44,7 % (37/37) |
| ambush | Payer le péage | 14 ferraille | 0 | -14 | 0 | 0 | 0 | 0 | 44,0 % (35/37) |
| ambush | Forcer le barrage | aucun | 0 | 0 | 0 | 0 | 0 | -0,18 | 43,3 % (37/37) |
| survivor | Accueillir à bord | 2 provisions | 0 | 0 | -2 | 0 | 1 | 0 | 44,7 % (34/34) |
| survivor | Échanger des vivres | aucun | 0 | 0 | +4,2 | 0 | 0 | -0,036 | 44,0 % (34/34) |
| survivor | Passer son chemin | aucun | 0 | 0 | 0 | 0 | 0 | 0 | 44,0 % (34/34) |
| crossroads | Le raccourci | aucun | +3,6 | 0 | 0 | 0,4 | 0 | 0 | 44,7 % (38/38) |
| crossroads | Autoroute | 4 carburant | -4 | +6 | 0 | 0 | 0 | 0 | 46,3 % (38/38) |

Lecture : aucun choix ne domine nettement sur le taux de victoire du bot. L'écart maximal à l'intérieur d'un même événement est de 2,0 points (merchant : 44,7 à 46,7 %), dans le bruit d'un test apparié à 300 graines. En valeur analytique en carburant, « Siphonner les cuves » domine « Pompe manuelle » (EV +15 carburant contre +12 carburant et -2 provisions, pour -2,5 % de PV attendus). En ferraille, la ferraille gagnée vaut peu car elle est en excès (voir section 2).

## 5. Recommandations (max 8)

Chaque effet est mesuré sauf mention contraire.

**R1. Boss final trop dur à niveau 0.** `src/config/balance.ts:67`, `boss.hp` : 1150 → **920** si l'objectif est environ 50 % de victoire à niveau 0. Mesuré (en mémoire, N=400) : 41,3 % → 49,8 % (920) ; 1380 donne 33,3 %. Effet : environ ±8 points par ±20 % de PV du boss. Le boss n'apparaît que dans le segment final (`src/game/sim/sim.ts:301`).

**R2. Progression méta trop courte.** `src/game/upgrades.ts:42-47`, `costs` : doubler tous les coûts (ex. `hull: [12, 28, 50]` → `[24, 56, 100]`). Mesuré : 6,6 → **12,7 expéditions** pour tout acheter (médiane 7 → 13). Ajuster le facteur à la durée visée. Un coût ×0,5 donne 3,7.

**R3. Ne pas utiliser le coût des améliorations d'atelier pour résorber la ferraille.** `src/game/upgrades.ts:17-30`, `cost` : ×1,5 mesuré donne 41,3 % → 40,3 % et une ferraille fin de partie médiane inchangée (46). Ce levier est inefficace.

**R4. Excès de ferraille structurel.** Ferraille fin de partie médiane 46 (niveau 0) à 169 (niveau 3), jamais à zéro. Piste : réduire le gain de ferraille des événements (`src/game/events.ts:81`, `:100`, `:53`, `:90`) ou ajouter un puits de ferraille (ex. `src/game/run.ts:161`, `FIELD_HP_PER_SCRAP = 2` → 1, réparation de terrain deux fois plus chère). **Effet non mesuré** : la constante n'est pas modifiable en mémoire. À valider avec `scripts/balance.ts` après le changement.

**R5. Choix « Pompe manuelle » dominé.** `src/game/events.ts:25`, `res: { fuel: 12 }` avec coût `food: 2`. Siphonner (`events.ts:22-23`) donne +15 carburant en valeur attendue pour -2,5 % de PV, contre +12 carburant et -2 provisions. Proposition : `fuel: 12` → `fuel: 16`, ou coût `food: 2` → `food: 1`. **Effet sur le taux de victoire : non mesurable** (44,7 % dans les trois cas).

**R6. Pas de changement de chiffres d'événements sur la base de ce bot.** Écart maximal de victoire entre choix d'un même événement : 2,0 points (merchant), dans le bruit. Les chiffres d'événements ne sont pas déterminants pour le bot. Une validation sur joueurs humains est nécessaire avant de modifier `src/game/events.ts`.

**R7. `scripts/balance.ts` trop petit et trop simplifié.** `scripts/balance.ts:3-5` : N par défaut 20 (N=50 utilisé) et niveau méta uniforme, qui ne représente pas le chemin d'achat réel. Mesuré : à niveau 0, N=50 donne 44 % et N=400 donne 41,3 % (IC 95 % ±4,8). Proposition : N ≥ 400, afficher l'IC 95 %, et simuler le chemin d'achat (voir section 3).

**R8. Biais du joueur automatique sur les événements.** `tests/unit/autoplay.ts:38` : le bot prend le premier choix abordable, ce qui fausse les statistiques d'événements et de ressources (le bot ne choisit jamais « Pompe » si « Siphonner » est abordable). Proposition : tirer le choix au hasard ou mesurer chaque choix séparément (méthode utilisée en section 4). **Effet non mesuré** sur les conclusions globales.

## Résumé (5 lignes)

1. Taux de victoire mesuré (N=400) : niveau 0 41,3 %, niveau 1 74,8 %, niveau 2 89,8 %, niveau 3 98,0 %. Le boss final cause 58 à 68 % des défaites.
2. La ferraille n'est jamais épuisée (médiane 46 à 169), le carburant l'est parfois (5 % des fins à 0 au niveau 0), les provisions quasi jamais.
3. L'arbre méta (487 pièces) est entièrement acheté en 6,6 expéditions en moyenne (médiane 7).
4. Aucun choix d'événement ne domine sur le taux de victoire (écart max 2,0 points) ; « Pompe manuelle » est dominé en valeur attendue.
5. Trois recommandations sont chiffrées et mesurées (boss, coûts méta, coût des améliorations d'atelier) ; les autres sont à valider car leur effet n'a pas été mesuré.
