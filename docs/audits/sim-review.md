# Revue de bugs : simulation de segment (src/game/sim/sim.ts)

Périmètre : `src/game/sim/sim.ts` (contexte : `src/config/balance.ts`, `src/game/upgrades.ts`, `tests/unit/sim.test.ts`). `src/scenes/DriveScene.ts` non audité (modifié par un autre agent), lu seulement pour le contrat d'appel de `sim.update`.

Scripts de preuve : `/tmp/claude-0/h4/v1.ts` à `v5.ts` (lancés depuis `/home/user/Convoy-Zero` avec `npx vite-node`). Aucun fichier source modifié.

## Constats (classés par sévérité)

### 1. [haute] Le Béhémoth réapparaît après sa mort, la fin de segment se déclenche avec un boss vivant

- Fichiers : `src/game/sim/sim.ts:289` (`if (k === 'final' && !this.boss && this.distance > 1400)`), `sim.ts:739` (`if (e === this.boss) { ... this.boss = null; ... }`), `sim.ts:153` (`endTimer = 2.5` posé à la première mort).
- Scénario : le boss meurt. `killEnemy` remet `this.boss = null` et `bossDefeated = true`. Au pas suivant, `updateSpawns` voit `!this.boss` et la distance > 1400, il en crée un nouveau (uid différent, événement `bossSpawn`). Le compte à rebours de 2,5 s se termine, et `outcome = 'cleared'` est posé alors que ce second boss est vivant.
- Preuve (`v3.ts`) : après `damageEnemy(boss, mortel)`, les événements contiennent `kill` boss, puis `bossSpawn` avec uid 17 (premier boss : uid 9). Fin à t = 2,52 s, `outcome = cleared`, boss vivant à la fin : `true`.
- Correctif : ne faire apparaître le boss qu'une fois, avec un drapeau `bossSpawned` (`if (k === 'final' && !this.bossSpawned && ...) { this.bossSpawned = true; ... }`). Ne pas tester `!this.boss`.
- Trou de test : `tests/unit/sim.test.ts` (« rencontre finale ») ne vérifie pas l'absence de réapparition.

### 2. [haute] La vitesse de simulation dépend de la cadence d'écran

- Fichiers : `src/game/sim/sim.ts:132` (`const steps = Math.min(30, Math.max(1, Math.round(dt / SIM_DT)));`), appelé avec le delta brut par `src/scenes/DriveScene.ts:157`.
- Scénario : `Math.round` arrondit le nombre de pas à 1 pour tout dt entre 1/120 et 3/120 s environ, et chaque pas avance toujours de 1/60 s. Sur un écran à 120 Hz ou plus, le temps simulé dépasse le temps réel.
- Preuve (`v1.ts`, 10 s réelles) : 60 Hz → 10,00 s simulées ; 120 Hz → 20,00 s ; 144 Hz → 24,00 s ; 240 Hz → 40,00 s. Défilement, cadence de spawn, durée des télégraphies et des gusts sont donc tous accélérés. Les tests utilisent `1/60` et ne voient pas le problème.
- Correctif : accumulateur, `this.acc += dt; let n = 0; while (this.acc >= SIM_DT && n < 30) { this.step(SIM_DT, input); this.acc -= SIM_DT; n++; }` (en plafonnant `acc` à quelques pas pour éviter la spirale). À faire côté `sim.update`, sans rien changer à l'appelant.

### 3. [moyenne] Un kamikaze qui explose se compte comme kill du joueur, avec butin ; les morts causées par une explosion ennemie aussi

- Fichiers : `src/game/sim/sim.ts:412` (`this.explode(e.x, e.y, 95, ..., true); this.killEnemy(e, false);`), `sim.ts:693-696` (la boucle de `explode` inclut l'émetteur, encore non mort), `sim.ts:696` (`damageEnemy(e, damage * 1.5, ...)`), `sim.ts:731-740` (`killEnemy(e, loot)` : `kills += 1`, `killsByType`, événement `kill`, butin si `loot`).
- Scénario : à l'expiration de la mèche, `explode` atteint le kamikaze lui-même (pas encore marqué mort). `damageEnemy` lui inflige 38 × 1,5 = 57 PV, il meurt avec `loot = true` : il est compté comme tué par le joueur et lâche de la ferraille. L'appel `killEnemy(e, false)` qui suit ne fait rien (déjà mort). Idem pour tout ennemi voisin tué par le souffle.
- Preuve (`v1.ts`) : kamikaze détonant seul, sans action du joueur : `kills = 1`, `killsByType = {kamikaze: 1}`. Puis (`v2.ts`, tir du convoi désactivé) : un kamikaze fait exploser un maraudeur voisin : `kills = 2`, `{kamikaze: 1, marauder: 1}`.
- Correctif : séparer « tué par le joueur » de « mort par ricochet ». Par exemple `damageEnemy(e, dmg, x, y, byPlayer)` ; `killEnemy` n'incrémente `kills`/`killsByType` et ne lâche le butin que si `byPlayer`. Dans `explode`, passer `source` pour exclure l'émetteur de la boucle, ou marquer le kamikaze mort avant d'appeler `explode`.

### 4. [moyenne] Ferraille gonflée à la mort des ennemis (découpage en tas arrondi au plafond)

- Fichiers : `src/game/sim/sim.ts:742-747` (`n = max(1, round(def.scrap × U(0,7 ; 1,3)))`, `chunks = min(6, n)`, puis `addPickup('scrap', Math.ceil(n / chunks), ...)` répété `chunks` fois).
- Scénario : dès que `n > 6`, `ceil(n/6)` × 6 dépasse `n`. Exemple : n = 7 → 6 tas de 2 = 12 ferraille.
- Preuve (`v5.ts`, 300 graines par type, ferraille créée par mort) : Blindé (config 9) → **11,82** (+31 %) ; Béhémoth (config 40) → **42,80** (+7 %) ; Maraudeur (config 2) → 2,03 (inchangé, n ≤ 6).
- Correctif : répartir exactement : `const base = Math.floor(n / chunks), rem = n % chunks;` le tas i reçoit `base + (i < rem ? 1 : 0)`. Ou ne créer qu'un tas par tranche de 1 unité, sans `ceil`.

### 5. [moyenne] Des ennemis qui sortent de la scène ne sont jamais retirés (fantômes)

- Fichiers : `src/game/sim/sim.ts:390` (gunner, `VIEW.w + 300` = 1580), `sim.ts:396` (éclaireur, idem), `sim.ts:384` (maraudeur en fuite, cible x = -200), seuil de retrait `sim.ts:468` (`e.x < -260 || e.x > VIEW.w + 420`, soit 1700 / -260), contrôle de spawn `sim.ts:287` (`if (k === 'demo' && this.enemies.length >= 2) return;`).
- Scénario : `steer` approche la cible sans la dépasser (la vitesse tend vers 0 quand la distance tend vers 0). Un éclaireur ou un tireur qui atteint sa cible à 1580 ne franchira jamais 1700 : il reste dans `enemies` et est impossible à toucher (`pickTarget` exclut x > 1270). Pour le maraudeur en fuite, la cible (-200) est en dehors du seuil -260, donc il ne sort jamais non plus.
- Preuve (`v1.ts`, éclaireur et tireur forcés en fuite, 60 s) : éclaireur `x = 1580, vivant = true`, tireur `x = 1580, vivant = true`. (`v4.ts`) maraudeur en fuite après 30 s : `x = -82, vivant = true` ; il se stabilise autour de -82 parce que la poussée vers le convoi compense la fuite, bien au-delà du seuil -260.
- Conséquence : la liste d'ennemis grossit sans fin dans les longs segments. En mode démo, deux fantômes suffisent à arrêter tous les spawns (`sim.ts:287`) ; cet effet n'a pas été mesuré directement, la démo ayant été tuée par le convoi dans `v4.ts`.
- Correctif : retirer selon l'état, par exemple `if (e.state === 'leave' || e.state === 'exit') && (e.x < -150 || e.x > VIEW.w + 150)`, ou faire converger les cibles au-delà du seuil (`VIEW.w + 500`, `-320`).

### 6. [basse] Le bouclier de choc n'accorde pas d'invulnérabilité : un contact continu traverse le bouclier au pas suivant

- Fichiers : `src/game/sim/sim.ts:703-707` (sortie anticipée sans `v.invuln = 0.35`), `sim.ts:457` (les contacts ne sont filtrés que par `v.invuln`).
- Scénario : un blindé en contact absorbe son premier impact (bouclier armé). Au pas suivant, comme `invuln` vaut toujours 0, le contact est traité à nouveau, et comme `shieldCd` vaut 12 s, le bouclier ne s'applique plus : le second impact passe entièrement. L'effet visé (« annule le prochain gros impact ») devient « retarde d'un pas ».
- Preuve (`v5.ts`) : 1er impact 30 → 0 PV perdus (absorbé). Second impact dans la même trame → 30 PV perdus. `invuln` vaut 0,35 seulement après le second.
- Correctif : `if (dmg >= 20 && ...) { ...; v.invuln = 0.35; return; }` pour que l'absorption protège aussi les impacts suivants pendant le délai d'invulnérabilité. Vérifier aussi que le bouclier ne consomme pas la trame d'un contact qui se répète.

### 7. [basse] Invulnérabilité incohérente : les explosions l'ignorent, les heurts non

- Fichiers : `src/game/sim/sim.ts:656` (contact avec baril ou mine : `detonateObstacle`), `sim.ts:690` (`damageVehicle(v, ..., true, 'explosion')` : `ignoreInvuln = true`), `sim.ts:657` (heurt avec rocher, carcasse ou nid-de-poule : `if (v.invuln <= 0)`).
- Scénario : une mine qui touche un véhicule déjà touché il y a 0,1 s lui inflige à nouveau 24 PV, alors qu'un rocher n'inflige rien pendant l'invulnérabilité. Les kamikazes en mèche ont le même comportement (`sim.ts:412`, `ignoreInvuln = true`).
- Preuve : raisonnement sur le code (pas de script). Les explosions ne sont pas bloquées par `invuln`, alors que les heurts le sont.
- Correctif : décider de la règle et l'appliquer partout. Si l'explosion doit ignorer l'invulnérabilité, documenter le choix ; sinon passer `false` depuis `explode`.

### 8. [basse] Division par zéro possible dans `progress` si `lengthOverride = 0`

- Fichier : `src/game/sim/sim.ts:127` (`get progress(): Math.min(1, this.distance / this.length)`), `sim.ts:109` (`lengthOverride ?? ...` accepte 0).
- Scénario : `length = 0` et `distance = 0` donnent `0/0 = NaN`, que `Math.min` laisse passer. Ne se produit que via `lengthOverride: 0`, donc hors chemin de production.
- Preuve : raisonnement sur le code.
- Correctif : `this.length > 0 ? Math.min(1, this.distance / this.length) : 1`.

## Non retenus / remarques

- Les ennemis de type « brute » s'arrêtent à x = 760 et restent jusqu'à leur mort (pas de sortie) : comportement de conception, pas un blocage, car le segment se termine à la distance.
- Pas de softlock de fin de segment trouvé sur les segments `route`, `event`, `workshop`, `camp`, `ambush` ni sur `final` (le boss ne peut pas sortir de l'écran : cible x = 830, seuil de retrait 1700).
- Aucun appel de `writeBack` en double (un seul appel dans `src/ui/app.ts:661`), donc pas de double comptage de kills ou de butin à ce niveau.
- Les tests de `tests/unit/sim.test.ts` ne couvrent ni le 120 Hz, ni la réapparition du boss, ni les fantômes, ni le butin.
