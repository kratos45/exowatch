# ExoWatch 🪐 & Near-Earth Objects (NEOs) ☄️ - Version 2.0 (Production)

## Objectif Final du Projet
Détecter, explorer et analyser les objets célestes atypiques ou dangereux à l'aide de l'intelligence artificielle, des graphes de connaissances (Knowledge Graphs) et de la modélisation 3D avancée.
Cette version 2.0 marque une refonte totale de l'architecture. Fini SQLite et Streamlit : le projet s'appuie désormais sur une stack moderne "Production Ready" avec **Neo4j**, **FastAPI**, **Next.js**, et l'intégration profonde des **LLMs (Large Language Models)** pour l'enrichissement des données et l'interaction en langage naturel.

## Architecture Data : Le Graphe de Connaissances (Neo4j)
La base de données relationnelle a été remplacée par **Neo4j**, une base de données orientée graphes, permettant de modéliser l'univers tel qu'il est : un réseau d'interactions complexes.

### L'Exploitation Avancée du Graphe (Graph Analytics)
Nous ne nous limitons pas à stocker des données, nous exploitons la théorie des graphes pour découvrir des informations cachées à l'aide d'algorithmes spatiaux avancés. Le système implémente 4 fonctionnalités majeures (Graph Data Science & Routing) :

1. **Routage Logistique (Shortest Path & Delta-V)** 🛣️
   Le graphe inclut la planète `Earth` et la future station `Lunar Gateway`. Des relations `[:REACHABLE_WITH_DELTAV]` lient ces hubs spatiaux aux astéroïdes exploitables. Ces relations possèdent des propriétés calculées automatiquement (Cost/Delta-V et Duration). L'algorithme de plus court chemin détermine ainsi la route spatiale la plus rentable pour le minage extraterrestre, directement affiché dans la Vue "Minage".

2. **Détection de Communautés (Clustering / Louvain)** 🌌
   Au lieu de classer les objets avec de simples filtres SQL, un algorithme de détection de communautés parcourt le réseau et regroupe automatiquement les objets en "Clusters" selon leurs propriétés géométriques (orbites) et physiques (Fer, Silicate, Glace). Le frontend exploite ce graphe pour coloriser dynamiquement chaque "famille" d'astéroïdes en temps réel dans le Graphe 2D (ex: Gris Métal pour le Fer, Bleu pour la Glace).

3. **Centralité de Menace (PageRank Spatial)** 🕸️
   Nous avons implémenté une variante de l'algorithme PageRank pour évaluer les menaces en chaîne. Au lieu d'afficher une simple probabilité, chaque nœud possède un *Indice de Centralité de Menace*. Ce score combine la probabilité d'impact avec l'énergie cinétique (masse, diamètre et vélocité) de l'astéroïde. Le "Top 10" des Hubs de Menace révèle les objets les plus dangereux de manière holistique.

4. **Knowledge Graph Sémantique Historique** 🛰️
   Le graphe ne s'arrête pas aux astéroïdes : il intègre les Télescopes (ex: `Kepler`, `TESS`) via des relations `[:DISCOVERED]` et les Missions Spatiales (ex: `OSIRIS-REx`, `Hayabusa2`) via `[:VISITED]`. Cette sémantique poussée permet au modèle IA (Text-to-Cypher) de répondre à des requêtes du type : *"Quels sont les astéroïdes composés de silicate découverts par TESS ?"*.

## Pipeline ETL (Extract, Transform, Load)
Le projet repose sur un pipeline de données complet et robuste pour garantir la qualité des données intégrées à notre base de graphes :
- **Extract (Collecte)** : Données récupérées via les API de la NASA (*NASA Exoplanet Archive*, *NeoWs*, et *JPL Sentry*) et stockées de manière immuable en local.
- **Transform (Validation, ML & Augmentation)** :
  - **Nettoyage** : Filtrage des données aberrantes ou incomplètes.
  - **Machine Learning (Isolation Forest)** : Calcul de scores d'anomalies multidimensionnels pour détecter les exoplanètes atypiques.
  - **Augmentation par LLM** : (Voir section suivante) Injection d'inférences IA pour pallier le manque de données physiques.
- **Load (Chargement Neo4j)** : Les entités et leurs relations (`ORBITS`, `THREATENS`) sont structurées et insérées dans le graphe de connaissances avec des requêtes Cypher optimisées (gestion des `MERGE`).

## LLM au Cœur du Système (Intelligence Artificielle)

L'IA n'est plus un simple gadget d'explication, elle pilote désormais le cœur de la plateforme, de la donnée brute jusqu'à l'interaction utilisateur.

### 1. Augmentation et Enrichissement des Données (Data Augmentation)
Les API de la NASA (NeoWs, Sentry) fournissent des données orbitales et physiques basiques, mais souvent incomplètes pour l'exploitation minière ou l'analyse des matériaux.
Durant l'ETL, nous utilisons un LLM (via `OpenAI/OpenRouter` - variables d'environnement gérées via `.env`) pour **enrichir la base de données Neo4j** :
- **Prédiction de Matériaux** : L'IA analyse les caractéristiques orbitales, l'albédo et la taille pour prédire la composition probable de l'astéroïde (Roche, Silicate, Fer, Nickel, Glace).
- **Analyse de Porosité et de Risque** : Le LLM attribue un score de porosité, détermine un niveau de risque textuel, et évalue si l'objet est "Exploitable" d'un point de vue minier.
- Ces métadonnées générées par l'IA sont injectées de manière structurée dans les nœuds `NEO` de la base Neo4j.

### 2. Module Text-to-Cypher (UPLINK GLOBALE)
L'interface utilisateur intègre un chat global permettant d'interroger la base de données Neo4j en langage purement naturel.
- **Traduction NL -> SQL/Cypher** : L'utilisateur demande *"Quels astéroïdes font plus de 10km ?"*. Le backend FastAPI transmet le schéma Neo4j au LLM, qui génère la requête `Cypher` correspondante et l'exécute de manière sécurisée.
- **Synthèse des Données (Natural Language Generation)** : Au lieu de retourner le JSON brut (difficile à lire), un **second appel LLM** ingère le JSON de la réponse de la base de données, et formule une réponse claire, concise et professionnelle (style NASA) à l'utilisateur.

## Architecture Web (Production Ready)

La plateforme web a été redéveloppée pour des performances industrielles :
- **Backend (FastAPI - Python)** : Expose les endpoints REST (`/api/asteroids`, `/api/mining`, `/api/chat`, etc.) et gère les connexions au driver Neo4j. Les requêtes utilisent des fonctions comme `COALESCE` pour assurer la robustesse des données incomplètes.
- **Frontend (Next.js 16 + React + TailwindCSS)** : Une interface immersive "Cockpit de Vaisseau Spatial" entièrement refondue dans un thème **"Pristine White Neon"** avec des ombres portées dynamiques et un fond clair pur.
- **Simulations Graphiques** :
  - **Graph spatial (Neo4j)** : Visualisation du réseau via `react-force-graph-2d`.
  - **Modélisation 3D (Shap-E)** : Génération par IA de modèles 3D d'astéroïdes en fonction de la prédiction des matériaux.
  - **Simulation de Vitesse (Matplotlib)** : Moteur 2D rapide pour simuler visuellement la vitesse d'interception et d'impact des objets spatiaux de manière proportionnelle.

## Guide de Démarrage

1. **Base de Données (Neo4j)**
   - Démarrez votre instance locale Neo4j Desktop (port 7687, user: `neo4j`, pass: `exowatch2024`).

2. **Lancement du Backend (FastAPI)**
   ```powershell
   python -m venv .venv312
   .\.venv312\Scripts\Activate.ps1
   pip install -r requirements.txt
   python -m uvicorn api:app --port 8000
   ```
   *(Note : Pour Windows/CUDA, ne pas utiliser `--reload` avec Shap-E).*

3. **Lancement du Frontend (Next.js)**
   ```powershell
   cd frontend
   npm install
   npm run dev -- -p 3000
   ```

4. **Accès**
   Ouvrez votre navigateur sur `http://localhost:3000`. L'interface de commande ExoWatch est en ligne.