# CONVOY ZERO — Cahier des charges V1.0

**Studio :** Azerya Studio  
**Date :** 13 novembre 2026  
**État :** concept et cinq choix de cadrage validés ; détails ci-dessous proposés pour un premier jeu-test.  
**Mission :** mini-jeu complet, autonome, jouable sur PC et téléphone via navigateur.

## 1. Intentions et choix verrouillés
- Vue : **2D du dessus**, illustration moderne, formes nettes, ambiance post-apocalyptique ; ne pas basculer en pixel art ou 3D.
- Gameplay : équilibre entre **gestion, exploration et combats**.
- Progression : **roguelite**. Chaque expédition recommence ; amélioration permanente entre expéditions.
- Ambition : **mini-jeu complet**, pas uniquement une scène technique : menus, sauvegarde, plusieurs systèmes, audio, tutoriel, écran de fin.
- Orchestrateur : **autonomie jusqu'à livraison**, avec garde-fous techniques et sans validations intermédiaires de l'utilisateur.
- Contrôle de déplacement : **hybride** (convoi automatique par défaut ; commande directe disponible). 
- Cible : application web responsive PC et mobile, sans serveur obligatoire.

## 2. Pitch
Dans un monde abandonné, un petit convoi de survivants cherche à rejoindre un refuge au-delà des terres mortes. La route est ponctuée d'attaques, de stations abandonnées et de décisions coûteuses. Garder les véhicules opérationnels, économiser carburant et provisions, récupérer de la ferraille et franchir l'ultime embuscade.

## 3. Identité visuelle
- 2D vue du dessus ou légère inclinaison artistique **sans fausse 3D jouable** ; illustrations vectorielles ou raster dessinées à la main / formes procédurales soignées.
- Palette chaude (sable, rouille, asphalte), contrastée par turquoise/bleu pétrole pour UI et signaux ; scène de nuit possible mais lisibilité prioritaire.
- Silhouettes immédiatement distinctes pour les véhicules et les 5 ennemis. Routes fissurées, poussière, carcasses, panneaux, pierres, oasis rare, zones industrielles.
- VFX de poussière, tirs, impacts, débris et fumée ; animations satisfaisantes sans surcharge.
- Pas d'assets sous licence douteuse ni de ressources externes requises à l'exécution. Audio procédural ou assets correctement licenciés avec attribution.

## 4. Boucle d'expédition
1. Garage : sélection et achat éventuel des bonus permanents, présentation des commandes.
2. Carte procédurale à embranchements : choisir la prochaine étape parmi deux ou trois routes, avec risques/récompenses visibles.
3. Segment de convoi : déplacement, esquive optionnelle, attaque automatique, menaces variées, collecte.
4. Événement : fouille, marchand, camp, accident, embuscade ou carrefour ; choix tactiques et coût en ressources.
5. Réparation et achat d'améliorations d'expédition.
6. Épreuve finale et bilan (victoire/défaite, distance, ressources, ennemis, monnaie permanente).
7. Retour au garage, progression persistante, nouvelle expédition.

**Durée visée :** 5 à 10 minutes par expédition achevée. **Équilibrage :** un premier joueur doit pouvoir comprendre et faire progresser une partie sans connaissance préalable ; difficulté croissante et issue atteignable.

## 5. Déplacement et contrôles
- Convoi composé du véhicule de commandement et de deux véhicules d'escorte.
- Conduite automatique par défaut ; vitesse stable et trajectoire lisible, avec sensation visuelle de mouvement du monde et de la route.
- Contrôle manuel temporaire du véhicule principal : clavier flèches/WASD, ou joystick/zone tactile. Basculer ou maintenir pour reprendre la conduite ; retour facile au mode automatique.
- Les escortes suivent selon une formation stable, sans chevauchements visuels excessifs. Collisions/marges adaptées.
- Tirs automatiques avec ciblage prioritaire ; le joueur se concentre sur la trajectoire, le positionnement, les réparations et les choix.
- Pause fiable, reprise immédiate, vitesse de simulation correcte en arrière-plan.

## 6. Véhicules
1. **Commandement :** véhicule principal. Sa destruction entraîne la défaite.
2. **Escorte :** tirs rapides et portée modérée.
3. **Récupérateur :** bonus de ramassage ou défenses faibles ; présence visuelle et utilité réelle.
Chaque véhicule dispose de PV, de feedback de dégâts et au moins d'une propriété distincte. Les dégâts persistent pendant l'expédition. Possibilité de réparer en événement ou étape prévue. Les escortes détruites ne doivent pas bloquer la progression.

## 7. Ennemis et combats
Minimum 5 archétypes avec comportement visible :
- Maraudeur rapide : approche agressive ; fragile.
- Tireur : reste à distance et lance des projectiles lisibles.
- Éclaireur : déplacement latéral / harcèlement.
- Blindé : lent, résistant, forte menace.
- Kamikaze : fonce et explose près des véhicules.
Une rencontre finale combine au moins deux archétypes et une menace renforcée. Prévoir télégraphie, invulnérabilité courte après impact si nécessaire, récupération de ressources, VFX/SFX et réglages centralisés.

## 8. Carte, biomes et événements
- Carte à embranchements générée depuis une graine reproductible ; sur une expédition, 5–7 étapes principales + confrontation finale.
- Trois biomes : **désert poussiéreux**, **zone industrielle**, **route nocturne / terres mortes**. Différences visuelles + au moins une différence d'obstacles/risques chacune.
- Minimum huit événements parmi : station-service, ferrailleur, convoi marchand, camp abandonné, carcasse à fouiller, passage miné, tempête, embuscade, survivant isolé, croisement dangereux.
- Les événements proposent des choix explicites, des résultats déterministes ou probabilistes annoncés sans tromperie, et des coûts vérifiables.
- Aucun softlock : si les ressources sont trop faibles, règles de secours clairement définies (dépannage coûteux, route d'urgence ou fin de partie explicite).

## 9. Ressources, améliorations, progression
**Ressources d'expédition :** carburant, ferraille, provisions. Affichage permanent avec variations compréhensibles ; économie fermée, valeurs non négatives.
**Améliorations pendant l'expédition :** au moins 12 choix ou niveaux distincts répartis entre blindage, puissance, cadence, collecte, efficacité carburant, réparations et soutien. Réinitialisation à chaque run.
**Méta-progression :** monnaie persistante « pièces de convoi » obtenue au bilan, 6 améliorations permanentes achetables (PV initiaux, carburant, ramassage, dégâts légers, bonus de provisions, réparations). Achats idempotents et sauvegardés.
- Le joueur ne doit pas pouvoir débloquer l'ensemble dès la première partie ; progression mesurée sans grind excessif.
- Les choix d'amélioration ont un effet immédiatement observable et sont testables.

## 10. Écrans et expérience utilisateur
Menu principal (Jouer, Garage, Comment jouer, Paramètres) ; garage/méta-progression ; carte ; scène de traversée ; événement et boutique ; pause ; victoire/défaite avec statistiques ; paramètres audio/commandes ; courte première aide.
- UI PC souris/clavier, mobile tactile portrait ou paysage **avec une orientation explicitement choisie par l'implémentation**. Recommandation : paysage, avec instructions si l'écran est trop étroit.
- Touch targets >= 44 px CSS lorsque possible ; HUD non superposé aux contrôles ; textes lisibles, feedback interactif, contraste suffisant.
- États vides, audio coupé, redimensionnement de l'écran, retour navigateur et téléphone mis en veille gérés proprement.

## 11. Audio
Musique d'ambiance ou boucle d'atmosphère ; effets distincts pour tir, impact, explosion, collecte, sélection UI, victoire/défaite. Contrôles musique/SFX, muet et volume enregistrés. Respecter l'activation du son sur interaction utilisateur des navigateurs mobiles. Aucun chargement externe impératif au démarrage.

## 12. Sauvegarde et robustesse
- LocalStorage pour améliorations permanentes, paramètres, statistiques de profil ; versionner le schéma, gérer données absentes ou corrompues, conserver les acquisitions après rechargement.
- La reprise en milieu d'expédition est facultative ; si absente, indiquer clairement que quitter termine la run. Ne jamais promettre une reprise non implémentée.
- Aucun compte ni backend en V1. Aucune clé API, secret ou donnée personnelle.
- Tests de valeur, économie, génération reproductible et migrations de sauvegarde.

## 13. Stack et structure
- **Par défaut : Phaser + TypeScript + Vite**, tests unitaires Vitest et tests de navigateur Playwright. L'orchestrateur peut ajuster après justification explicite et validation technique automatisée ; ne pas changer la cible web.
- Architecture modulaire : états/scènes, simulation & combat, monde/procédural, ressources et progression, UI, persistence, audio, data de configuration.
- Boucles de simulation distinctes des composants UI ; entrées configurées ; gestion centralisée du temps ; data-driven pour équilibrage.
- Pas de dépendance runtime distante ; mise en ligne compatible GitHub Pages (base path configuré) et Vercel.
- Ne pas toucher aux dépôts ni aux données de Polar Rift, WAKELESS ou autres jeux existants.

## 14. Critères de recette (definition of done)
- `npm install` puis `npm run build` réussissent dans un dépôt propre ; `npm test` réussit ; parcours e2e Playwright au moins sur desktop et viewport mobile (avec limites honnêtement reportées).
- Navigation menu → garage → expédition → carte/rencontre/événement → victoire ou défaite → garage fonctionnelle.
- Pilotage automatique et manuel, trois véhicules visibles et mécaniquement distincts, cinq ennemis testables, trois biomes, huit événements, douze améliorations de run et six permanentes.
- Carte reproductible par seed ; pas de blocage de progression, de nombres négatifs de ressources ou de crash lors d'une fin de run.
- Sauvegarde méta après fermeture/rechargement, volumes audio réglables, mobile utilisable au toucher.
- Captures PC/mobile et vidéo ou captures des scènes clés si infrastructure disponible ; vérifier les images, pas seulement les tests.
- Mesurer performances et absence de fuites grossières sur de longues sessions ; gestion des onglets en arrière-plan.
- README d'installation, commandes, fonctionnement, raccourcis, attribution des assets, limitations connues, rapport final comparant chaque critère.

## 15. Règles de périmètre et priorisation
- Toutes les exigences dites « minimum » sont nécessaires pour déclarer la V1 complète.
- Opus peut adapter les détails non verrouillés : valeurs d'équilibrage, nom des événements, visuels exacts, géométrie de la carte et système interne.
- Si la ressource de tokens devient insuffisante : préserver build fonctionnel, tests, sauvegarde, boucle complète et documenter la couverture exacte ; ne pas annoncer « terminé » si certains critères manquent.
- Interdit sans décision utilisateur : achats intégrés, publicité, compte utilisateur, backend payant, achat de services, publication publique en production, suppression de données externes, modifications aux projets existants.
- Aucune attente d'une validation humaine entre les étapes : arbitrage par l'orchestrateur dans le périmètre, sauf blocage irréversible nécessitant une autorisation explicite.

## 16. Critères de réussite de l'expérimentation agentique
Suivre : nombre total d'agents invoqués, pic de parallélisme, tâches acceptées / réouvertes, tokens par tâche si observables, tests/régressions, temps de redémarrage, qualité des handoffs, écarts entre cahier des charges et livrable. Ne pas inventer de métriques indisponibles.
