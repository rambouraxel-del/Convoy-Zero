# ISSUES

| # | Défaut | Sévérité | Repro | Traitement |
|---|---|---|---|---|
| I1 | 0 victoire en pilote auto (dégâts des tirs trop élevés, aucune réparation entre étapes) | Haute | `scripts/balance.ts` | Corrigé : dégâts Tireur/Éclaireur réduits, réparation de fortune ajoutée (D9) |
| I2 | Le Béhémoth restait hors de portée des armes du convoi | Haute | finale en headless | Corrigé : position de maintien x=830, convoi avance quand le boss est présent |
| I3 | Zone de notifications bloquant les clics/touchers dessous (spécificité CSS `#ui > *`) | Haute | e2e mobile : nœud de carte non sélectionnable | Corrigé (`#ui > .toast-area { pointer-events:none }`) |
| I4 | Double-clic au garage achetait deux niveaux (bouton recréé après achat) | Moyenne | e2e `dblclick` | Corrigé : anti double-clic 450 ms + niveau attendu |
| I5 | Cartes d'amélioration : nom coupé sur 3 lignes | Basse | capture butin | Corrigé (étiquette déplacée) |
| I6 | Boss entrant trop lentement / peu visible de nuit | Basse | capture boss | Corrigé (entrée rapide, halo) |

## Limitations connues (acceptées V1)
- Pas de reprise d'une expédition en cours après fermeture (annoncé en jeu).
- Audio vérifié par construction et absence d'erreurs ; écoute réelle impossible en environnement headless.
- Tests mobiles = émulation Chromium (Pixel 7 paysage), pas d'appareil physique ni Safari iOS.
- Mise en veille du téléphone : gérée via `visibilitychange` (pause + audio suspendu), testée par code, pas sur appareil.
- Bundle JS ~1,6 Mo (Phaser) : ~380 Ko gzip.
