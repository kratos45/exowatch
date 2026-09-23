# ExoWatch 🪐 & Near-Earth Objects (NEOs) ☄️

## Objectif Final du Projet
Détecter et explorer les objets célestes atypiques ou dangereux à l'aide de l'intelligence artificielle, des statistiques, et de la modélisation 3D avancée.
Initialement conçu pour analyser les **exoplanètes** (planètes en dehors de notre système solaire) et identifier celles présentant des caractéristiques physiques anormales, le projet a évolué pour intégrer les **objets géocroiseurs (NEOs)** — des astéroïdes orbitant le Soleil et s'approchant de la Terre. L'objectif final est de centraliser, nettoyer via un pipeline ETL robuste, et visualiser ces données dans une application interactive offrant des **simulations photoréalistes**. Ce projet facilite la compréhension de notre univers, allant de l'astrophysique lointaine à la sécurité planétaire immédiate.

## Pipeline ETL et Base de Données (SQLite)
Le projet repose sur un pipeline de données complet (ETL : Extract, Transform, Load) garantissant la reproductibilité et la qualité des données astronomiques.
- **Extract (Collecte)** : 
  - *Exoplanètes* : Récupérées via le service TAP de la *NASA Exoplanet Archive* au format CSV (`src/collect.py`).
  - *NEOs* : Importés via l'API *NASA NeoWs (Near Earth Object Web Service)* au format JSON (`src/collect_neo.py`).
  Les données brutes sont conservées de manière immuable et horodatée dans le dossier `data/raw/` pour assurer la traçabilité.
- **Transform (Validation & Transformation)** : Les données subissent des contrôles de qualité (absence de valeurs clés, mesures physiquement impossibles). Pour les exoplanètes, le système calcule deux scores d'atypicité (un heuristique statistique et un modèle multivarié basé sur le Machine Learning - *Isolation Forest* implémenté en pur Numpy).
- **Load (Chargement)** : Les données nettoyées, enrichies et validées sont insérées via des opérations idempotentes (`INSERT OR REPLACE`) dans une base de données **SQLite locale** (`data/curated/exowatch.db`). Cette approche centralisée élimine le besoin de dépendances système lourdes (aucune DLL problématique) tout en offrant toute la puissance relationnelle du SQL.

## Architecture du Code source
- `data/raw/` : Archives immuables des collectes (CSV / JSON).
- `data/curated/exowatch.db` : Base de données SQLite unique contenant les tables structurées `exoplanets` et `neo_objects`.
- `data/rejected/` : Fichiers CSV contenant les lignes ayant échoué à la validation, avec le motif détaillé du rejet.
- `src/db.py` : Script de définition du schéma relationnel et d'initialisation de la base SQLite.
- `src/collect.py` & `src/collect_neo.py` : Connecteurs aux API de la NASA.
- `src/validate.py` : Moteur de règles de qualité de données.
- `src/transform.py` : Le cœur de l'ETL (filtrage, calculs complexes, connexion et insertion SQL).
- `src/sim3d.py` : Moteur de génération de scènes WebGL (Three.js) pour les simulations photoréalistes.
- `app.py` : L'interface utilisateur (UI) interactive sous Streamlit (tableaux, graphes de population, et moteur 3D).

## Lexique Scientifique et Paramètres Orbitaux

### Pour les Exoplanètes (Astrométrie et Physique stellaire)
- **Rayon (pl_rade)** : Taille de la planète mesurée en *rayons terrestres* (R⊕). Un indicateur fondamental pour distinguer les petites planètes telluriques des géantes gazeuses.
- **Masse (pl_bmasse)** : Quantité de matière de la planète mesurée en *masses terrestres* (M⊕).
- **Période orbitale (pl_orbper)** : Le temps (en jours terrestres) mis par la planète pour faire une révolution complète autour de son étoile. 
- **Température effective (st_teff)** : La température de surface (en Kelvin) de l'étoile hôte. Elle est cruciale pour déterminer la "zone habitable".

### Pour les Objets Géocroiseurs - NEOs (Mécanique Céleste)
- **Demi-grand axe (semi_major_axis - *a*)** : La distance moyenne entre l'astéroïde et le Soleil, mesurée en Unités Astronomiques (1 UA = distance Terre-Soleil, soit ~150 millions de km).
- **Excentricité (eccentricity - *e*)** : Décrit la forme géométrique de l'orbite. À `0`, l'orbite est un cercle parfait. Plus elle s'approche de `1`, plus l'orbite est écrasée (elliptique).
- **Périhélie et Aphélie** : Les points de l'orbite les plus proches et les plus éloignés du Soleil.
- **PHA (Potentially Hazardous Asteroid)** : Un statut (Oui/Non) attribué par la NASA aux objets croisant dangereusement l'orbite terrestre.

## Fonctionnalités Avancées : Intelligence Artificielle & Simulations WebGL
L'interface de l'application va bien au-delà de la simple restitution de données brutes :

1. **L'IA Explicative (Google Gemini)** : 
   Totalement intégrée, l'IA génère des explications vulgarisées en temps réel. Si un utilisateur sélectionne une planète détectée comme anormale, Gemini formule des hypothèses astrophysiques plausibles. Pour un astéroïde, Gemini décortique ses paramètres orbitaux pour expliquer clairement pourquoi sa trajectoire est (ou n'est pas) une menace pour la Terre.

2. **Graphes Globaux de Population (Plotly)** : 
   Des nuages de points 3D de comparaison globale permettent de situer visuellement chaque objet par rapport à toute la population connue.

3. **Simulateur Spatial Photoréaliste (Three.js)** :
   Un composant sur-mesure injecte un véritable moteur 3D (WebGL) directement dans Streamlit pour animer les systèmes célestes !
   - **Moteur interactif** : L'utilisateur peut pivoter, zoomer et se déplacer dans la scène librement (`OrbitControls`).
   - **Modélisation des NEOs** : Affiche le Soleil brillant, la Terre (avec une texture réaliste haute définition) orbitant en 1 UA, et modélise en direct l'orbite elliptique de l'astéroïde en calculant sa trajectoire de Kepler (via le demi-grand axe et l'excentricité). Si l'astéroïde est un danger (PHA), sa teinte devient menaçante (rouge). Les astéroïdes sont modélisés sous forme géométrique rocailleuse.
   - **Modélisation des Exoplanètes** : L'étoile hôte prend une teinte basée sur sa température (ex: naine rouge, géante bleue) tandis que l'exoplanète orbite autour avec une taille extrapolée de son vrai rayon physique.

4. **Tableaux de Données Interactifs** : 
   L'utilisateur peut également consulter les données brutes dans des DataFrames Streamlit pour valider les analyses.

## Guide d'Installation et d'Exécution

1. **Prérequis système**
   - Python 3.11 ou supérieur
   - Connexion internet (pour les requêtes API et le chargement dynamique des librairies 3D)

2. **Configuration de l'environnement (.env)**
   Créez un fichier `.env` à la racine du projet :
   ```env
   GEMINI_API_KEY=votre_cle_gemini
   NASA_API_KEY=votre_cle_nasa
   ```

3. **Environnement virtuel (recommandé)**
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

4. **Lancement du Pipeline ETL (Ordre strict)**
   ```powershell
   python src\collect.py
   python src\collect_neo.py
   python src\transform.py
   ```

5. **Démarrage de l'Application Streamlit**
   ```powershell
   streamlit run app.py
   ```