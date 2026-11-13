# ISSUES

| # | Défaut | Sévérité | Repro | Traitement |
|---|---|---|---|---|
| I1 | 0 victoire en pilote auto (dégâts des tirs trop élevés, aucune réparation entre étapes) | Haute | `scripts/balance.ts` | Corrigé : dégâts Tireur/Éclaireur réduits, réparation de fortune ajoutée (D9) |
| I2 | Le Béhémoth restait hors de portée des armes du convoi | Haute | finale en headless | Corrigé : position de maintien x=830, convoi avance quand le boss est présent |
| I3 | Zone de notifications bloquant les clics/touchers dessous (spécificité CSS `#ui > *`) | Haute | e2e mobile : nœud de carte non sélectionnable | Corrigé (`#ui > .toast-area { pointer-events:none }`) |
| I4 | Double-clic au garage achetait deux niveaux (bouton recréé après achat) | Moyenne | e2e `dblclick` | Corrigé : anti double-clic 450 ms + niveau attendu |
| I5 | Cartes d'amélioration : nom coupé sur 3 lignes | Basse | capture butin | Corrigé (étiquette déplacée) |
| I6 | Boss entrant trop lentement / peu visible de nuit | Basse | capture boss | Corrigé (entrée rapide, halo) |
| I7 | Le Béhémoth réapparaissait après sa mort, fin de segment avec boss vivant (H4 #1) | Haute | `sim.test.ts` ne couvre pas la réapparition | Corrigé (S4) : drapeau `bossSpawned`, apparition unique |
| I8 | Simulation accélérée sur écrans 120/144/240 Hz (H4 #2) | Haute | 10 s réelles : 20 s à 120 Hz, 40 s à 240 Hz | Corrigé (S4) : accumulateur à pas fixe |
| I9 | Kamikaze auto-explosé compté comme kill avec butin ; ricochets comptés (H4 #3) | Moyenne | kamikaze seul : `kills = 1` | Corrigé (S4) : kill et butin seulement si tué par le joueur |
| I10 | Butin de ferraille gonflé à l'arrondi de découpage (Blindé +31 %) (H4 #4) | Moyenne | 300 graines par type | Corrigé (S4) : répartition exacte |
| I11 | Ennemis fuyants ou tireurs hors champ jamais retirés (fantômes) (H4 #5) | Moyenne | éclaireur resté à x=1580 après 60 s | Corrigé (S4) |
| I12 | Bouclier de choc sans invulnérabilité : le second impact passait (H4 #6) | Basse | 30 PV perdus au second impact | Corrigé (S4) : invulnérabilité 0,35 s |
| I13 | Division par zéro possible dans `progress` si `lengthOverride = 0` (H4 #8) | Basse | hors chemin de production | Corrigé (garde `length > 0`) |
| I14 | Recharger après défaite permettait de rejouer le segment perdu (faille de la reprise) | Non classée | e2e reprise | Corrigé : `clearRun` immédiat à la défaite. Coût : les pièces sont perdues si le rechargement intervient en moins de 1,4 s |

## Ouvert
- I15 : ~~invulnérabilité incohérente (H4 #7)~~ → corrigé par S4 : les explosions respectent l'invulnérabilité, sauf l'explosion télégraphiée d'un kamikaze ennemi (D16).
- I16 : focus clavier perdu à chaque re-rendu de l'UI (audit H1 #3).
- I17 : bulle de message de la carte qui recouvre un nœud 3 s sur mobile (cosmétique).
- I18 : lignes de visée rouges du Béhémoth non identifiables sur `desktop/08-boss.png` (non vérifié).

## Limitations connues (acceptées V1)
- Reprise d'expédition testée seulement en phase conduite (`saveRun('drive')`), pas en phase post-segment.
- Ferraille toujours en excès (médiane 46 à 169 selon le niveau) ; piste FIELD_HP_PER_SCRAP non mesurée.
- Pilote auto non représentatif d'un joueur humain : 41 % de victoires à niveau 0 ; le boss reste le mur (choix assumé, D17).
- Audio vérifié par construction et absence d'erreurs ; écoute réelle impossible en environnement headless.
- Tests mobiles = émulation Chromium (Pixel 7 paysage), pas d'appareil physique ni Safari iOS.
- FPS réel non mesurable sans GPU.
- Mise en veille du téléphone : gérée via `visibilitychange` (pause + audio suspendu), testée par code, pas sur appareil.
- Bundle JS ~1,6 Mo (Phaser) : ~380 Ko gzip.
