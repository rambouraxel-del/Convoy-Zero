# Audit H1 : accessibilité et ergonomie de l'UI (CONVOY ZERO)

Périmètre : src/ui/app.ts, src/ui/styles.css, src/ui/icons.ts, index.html, src/input/input.ts. Lecture seule, aucun fichier source modifié.
Contrastes calculés avec la formule WCAG 2.x (script : /tmp/claude-0/h1/contrast.js).

## Constats (11)

### 1. Éléments cliquables non-boutons inactivables au clavier : haute
- Fichiers : src/ui/app.ts:482 (nœuds de carte `<g role="button" tabindex="0">`), src/ui/app.ts:154 (`.card.choice role="button" tabindex="0"`).
- Preuve : `onClick` n'écoute que l'événement `click` (app.ts:72, 199-201). Recherche `keydown` / `Enter` dans src/ui et src/input : seul input.ts:17-21 gère Espace (bascule conduite) et Échap/P (pause). Aucun handler Entrée/Espace pour les `[data-act]` non natifs.
- Scénario : Tab amène le focus sur un nœud de carte ou une carte d'amélioration, Entrée et Espace ne font rien. Les nœuds de carte n'ont en plus aucune étiquette de texte pour la carte entière (voir constat 12).
- Correctif (app.ts, dans le constructeur, après `this.root.addEventListener('click', ...)`) :
```ts
this.root.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = (e.target as HTMLElement).closest?.('[role="button"][data-act]') as HTMLElement | null;
  if (!el || el.classList.contains('disabled')) return;
  e.preventDefault();
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
```
Le contrôle `disabled` évite d'activer une carte grisée. `dispatchEvent` fonctionne aussi sur les `<g>` SVG (`HTMLElement.click()` n'existe pas sur SVGElement).

### 2. Focus invisible sur les éléments non-boutons, cartes désactivées tabulables : moyenne
- Fichiers : src/ui/styles.css:71 (seule règle `:focus-visible`, limitée à `.btn`), styles.css:102 (`.card.disabled { pointer-events: none }`), app.ts:154 (pas de `aria-disabled`).
- Preuve : grep `focus-visible` renvoie uniquement styles.css:71. `.map-node` et `.card.choice` n'ont aucun style de focus. Une carte `.disabled` garde `tabindex="0"` et reste atteignable au clavier sans état annoncé.
- Scénario : sur la carte, le focus clavier est invisible ; sur l'atelier, une amélioration grisée reçoit le focus sans que l'état « indisponible » soit annoncé.
- Correctif (styles.css, après la ligne 71) :
```css
:focus-visible { outline: 3px solid var(--teal-light); outline-offset: 2px; }
.map-node:focus-visible .ring { opacity: 1; stroke: var(--teal-light); animation: none; }
```
Et dans app.ts:154, ajouter `aria-disabled="${afford ? 'false' : 'true'}"` à la carte.

### 3. Focus perdu à chaque re-rendu et hors des overlays : moyenne
- Fichiers : src/ui/app.ts:167 (`show`, remplace `screenEl.className` et le contenu), app.ts:183 (`screenEl.scrollTop = 0`), app.ts:317-319 (`rerender`), app.ts:698-709 (`openPause`), app.ts:722-729 (`confirmAbandon`).
- Preuve : chaque action (`ws-buy`, `buy-meta`, `field-repair`, `camp-scavenge`, `event-choice`) appelle `rerender()` ou `show()`, qui réécrit `innerHTML`. L'élément qui avait le focus est détruit, le focus revient au `body`. `openPause` et `confirmAbandon` n'appellent aucun `focus()` et l'overlay n'a ni `role="dialog"` ni `aria-modal`. Le Tab peut donc sortir de la pause vers le HUD. Aucun `.focus()` dans src/ (grep).
- Scénario : un joueur au clavier achète une amélioration à l'atelier, le focus retombe au début de la page et le scroll remonte en haut.
- Correctif (app.ts:317-319) :
```ts
private rerender() {
  const a = document.activeElement as HTMLElement | null;
  const act = a?.dataset.act, id = a?.dataset.id;
  const sy = this.screenEl.scrollTop;
  this.show(this.screen);
  this.screenEl.scrollTop = sy;
  if (act) this.screenEl.querySelector<HTMLElement>(`[data-act="${act}"]${id ? `[data-id="${id}"]` : ''}`)?.focus();
}
```
Pour les overlays, ajouter `role="dialog" aria-modal="true" aria-labelledby` sur le `.panel` de `openPause` et `confirmAbandon`, et appeler `.focus()` sur le premier bouton après `classList.remove('hidden')`.

### 4. Zoom désactivé par la balise viewport : haute
- Fichier : index.html:5.
- Preuve : `content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"`.
- Scénario : un joueur malvoyant ne peut pas zoomer sur Android (Chrome honore `user-scalable=no`). Contraire à WCAG 1.4.4 (AA) et 1.4.10. Sur iOS, le zoom reste possible, mais la règle ne doit pas être gardée.
- Correctif (index.html:5) : `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`.

### 5. Messages et toasts non annoncés aux lecteurs d'écran : moyenne
- Fichiers : src/ui/app.ts:66 (`<div class="toast-area" id="toasts">`), app.ts:110-117 (`toast()`), app.ts:738 (`eventResult`, résultat d'événement affiché sans annonce).
- Preuve : aucun `aria-live` ni `role="status"` dans src/ui ni index.html (grep).
- Scénario : « Étape franchie », « Remorquage forcé : −N PV », « Panne sèche évitée » ne sont lus par aucun lecteur d'écran.
- Correctif (app.ts:66) : `<div class="toast-area" id="toasts" role="status" aria-live="polite">`. Pour le résultat d'événement, dans app.ts:738, ajouter `role="status"` au `<div class="result-box">`.

### 6. Contraste insuffisant du texte des boutons alt et danger : moyenne
- Fichiers : src/ui/styles.css:72 (`.btn.alt`, texte --sand sur dégradé #3d8f94 → #1d5f6b), styles.css:74 (`.btn.danger`, texte #fff3e6 sur #e0634a → #9a2c1c). Texte de 17 px en gras, donc pas « grand texte » : seuil 4,5:1.
- Preuve (calculé) : `.btn.alt` : 2,65 en haut, 3,62 au milieu, 5,07 en bas. `.btn.danger` : 3,17 en haut, 4,64 au milieu, 6,98 en bas. Le haut du bouton, où le texte est centré, passe sous 4,5.
- Pour mémoire, conformes : --sand sur --ink 12,51 ; --sand-dim sur --ink-2 6,64 ; --sand-dim sur --ink 7,46 ; --sand-dim sur --ink-3 (.tag) 5,55 ; texte --ink sur le bouton rust 5,26 à 8,17 ; --danger #ff5a3a sur --ink-2 5,13 ; --gold sur --ink-2 9,50.
- Correctif (styles.css:72, 74) :
```css
.btn.alt { background: var(--petrol); color: var(--sand); }
.btn.danger { background: linear-gradient(180deg, #b8452f, #9a2c1c); color: #fff3e6; }
```
Résultats recalculés : petrol 5,07 ; #b8452f 4,89 (haut), 6,98 (bas).

### 7. Animations en boucle sans prefers-reduced-motion : moyenne
- Fichiers : src/ui/styles.css:113 (`.res.low` clignote 0,9 s infini), styles.css:173 (`.map-node.reachable .ring` pulse 1,4 s infini), styles.css:210 (`#rotate .phone`, 2 s infini).
- Preuve : grep `prefers-reduced-motion` sans résultat. Les clignotements et pulsations durent indéfiniment.
- Scénario : un clignotement continu sans moyen de l'arrêter gêne les personnes sensibles au mouvement ; WCAG 2.2.2 (AA) impose de pouvoir arrêter un contenu clignotant ou animé de plus de 5 s.
- Correctif (styles.css, fin du fichier) :
```css
@media (prefers-reduced-motion: reduce) {
  .res.low, .map-node.reachable .ring, #rotate .phone { animation: none; }
  .map-node.reachable .ring { opacity: 1; }
}
```

### 8. Chevauchement HUD en paysage mobile (hint, joystick, bouton de mode) : moyenne
- Fichiers : src/ui/styles.css:152-153 (`.hint` : `bottom: 22px`, centré, `max-width: min(560px, 70vw)`), styles.css:156 (`.joystick` : `left: 18px`, 150 px ; 124 px en max-height 500 à styles.css:227), styles.css:147-149 (`.mode-btn` : `right: 18px`, `min-width: 132px` ; 112 px à styles.css:229). Le `#hint` est ajouté en dernier dans `buildHud` (app.ts:619), donc peint au-dessus.
- Calcul pour une largeur de 640 px, hauteur de 360 px (paysage, max-height 500) : hint de 448 px, x 96 à 544 ; joystick x 18 à 142 : chevauchement de 46 px ; bouton de mode x 510 à 622 : chevauchement de 34 px. Pour 740 px : hint x 111 à 629 ; chevauchement avec le joystick de 31 px et avec le bouton de 19 px.
- Scénario : sur un téléphone en paysage, le texte d'astuce passe sous le joystick et le bouton AUTO/MANUEL. Le `pointer-events: none` du hint évite le blocage des commandes, mais le texte devient illisible. Mesure à vérifier dans un navigateur réel ; le calcul est fait sur les règles CSS.
- Correctif (styles.css, fin du fichier) :
```css
@media (pointer: coarse) and (max-height: 500px) {
  .hint { left: calc(160px + var(--safe-l)); right: calc(150px + var(--safe-r)); bottom: calc(10px + var(--safe-b)); transform: none; max-width: none; text-align: center; }
}
```

### 9. Ressources du HUD et de la carte sans nom accessible : moyenne
- Fichiers : src/ui/icons.ts:12 (`<span class="res" title="${RES_NAME[k]}">` contenant `<svg aria-hidden>` et `<b>${v}</b>`), app.ts:658 (HUD `#hud-res`).
- Preuve : `title` n'est pas un nom accessible fiable. Le contenu lisible est uniquement le nombre.
- Scénario : un lecteur d'écran annonce « 42 » sans dire s'il s'agit de carburant, de ferraille ou de provisions.
- Correctif (icons.ts:12) : `<span class="res" role="img" aria-label="${RES_NAME[k]} : ${v}" data-res="${k}">${ICON[k]}<b aria-hidden="true">${v}</b>${extra}</span>`. Le `extra` (delta « +3 ») est aussi masqué par le `role="img"`, c'est voulu : le delta est recalculé à chaque rafraîchissement.

### 10. Taille de texte 10 px dans le HUD en paysage mobile : basse
- Fichier : src/ui/styles.css:224 (`.hud-v { font-size: 10px }` en max-height 500).
- Preuve : la règle de base (styles.css:142) est à 12 px ; la règle paysage descend à 10 px, sous le minimum de lisibilité usuel de 12 px. Le HUD est en majuscules, ce qui réduit encore la lisibilité.
- Correctif (styles.css:224) : `.hud-v { grid-template-columns: 62px 1fr; font-size: 12px; }` et ajuster `min-width` de `.hud-vehicles` (styles.css:223) à 140px.

### 11. Jargon interne « V1 » visible par le joueur : basse
- Fichiers : src/ui/app.ts:394 (aide : « pas de reprise en V1 »), app.ts:708 (pause : « pas de reprise en V1 »).
- Preuve : lecture des deux chaînes.
- Correctif : remplacer par « Quitter termine l'expédition : elle ne peut pas être reprise. » (app.ts:394 et 708).

### 12. Carte SVG sans équivalent textuel global : basse
- Fichier : src/ui/app.ts:517 (`<svg viewBox=...>` sans `role`, `aria-label` ni `<title>`).
- Preuve : la chaîne de rendu de la carte ne contient aucun titre accessible. L'état de l'étape (« étape N / M ») est dans un `<h2>` (app.ts:516), mais la structure du graphe n'est pas décrite.
- Correctif (app.ts:517) : `<svg viewBox="..." role="group" aria-label="Carte des étapes, ${Math.min(step + 1, map.layers + 1)} sur ${map.layers + 1}">`.

## Non-constats vérifiés
- Boutons natifs (`<button>`) : activables au clavier par défaut ; `.btn:focus-visible` est défini (styles.css:71).
- Champ de graine (app.ts:369) : associé à son `<label>`, `font-size: 16px` (pas de zoom forcé iOS).
- Curseurs de volume : `aria-label` présent (app.ts:404-405).
- Bouton pause du HUD : `aria-label="Pause"` (app.ts:614) ; bouton de mode : `aria-pressed` (app.ts:646).
- Touches Flèches / WASD / Espace / Échap / P documentées dans l'aide (app.ts:381-383).
- Cibles tactiles : `.btn` min-height 48 px, `.btn.small` 44 px (styles.css:63, 76).

## Synthèse
Priorités : constats 1 et 4 (haute), puis 2, 3, 5, 6, 7, 8, 9 (moyenne), puis 10, 11, 12 (basse). Les correctifs 1, 4 et 5 sont des changements de quelques lignes et peuvent être faits ensemble.
