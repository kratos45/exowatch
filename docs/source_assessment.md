# Évaluation Critique des Sources de Données — ExoWatch

Ce document fournit une analyse critique des sources de données exploitées dans ExoWatch (NASA NeoWS et NASA JPL Sentry), détaille leurs limites intrinsèques et présente une feuille de route pour la montée en charge.

---

## 1. Analyse des Sources

### 1.1 NASA NeoWS (Near Earth Object Web Service)
- **Fournisseur** : NASA Planetary Defense Coordination Office (PDCO) / Space-Track / MPC (Minor Planet Center).
- **Endpoint Principal** : `https://api.nasa.gov/neo/rest/v1/feed`
- **Fréquence de Mise à Jour** : Quotidienne (au fur et à mesure des détections du Catalina Sky Survey, Pan-STARRS, ATLAS).
- **Points Forts** :
  - Standard de l'industrie pour le suivi des passages proches (< 7 jours).
  - Fournit des estimations dimensionnelles dérivées de la magnitude absolue $H$ combinée à un albédo standard supposé ($0.05 \le p_v \le 0.25$).
  - Données orbitales précises calculées par le Jet Propulsion Laboratory (JPL).

### 1.2 NASA JPL Sentry System
- **Fournisseur** : NASA JPL Center for Near Earth Object Studies (CNEOS).
- **Endpoint Principal** : `https://ssd-api.jpl.nasa.gov/sentry.api`
- **Rôle** : Système automatisé de surveillance des collisions potentielles pour les 100 prochaines années.
- **Métriques Clés** :
  - **Échelle de Palerme** : Échelle logarithmique comparant le risque d'impact au risque d'impact de fond d'objets de même taille. Une valeur supérieure à -2 mérite une attention particulière ; supérieure à 0 indique un danger supérieur au bruit statistique de fond.
  - **Échelle de Turin** : Échelle discrète de 0 à 10 pour la communication publique (0 = aucun risque, 10 = collision certaine et catastrophique).

---

## 2. Limites Identifiées & Facteurs de Risque Qualité

| Limite Identifiée | Impact sur le Pipeline | Solution Appliquée dans ExoWatch |
| :--- | :--- | :--- |
| **Rate Limiting API (`HTTP 429`)** | La clé `DEMO_KEY` de la NASA est bridée à 30 requêtes/heure et 50/jour. | Mécanisme de retry exponentiel avec backoff (`src/collect.py`) et bascule vers un payload de test synthétique en cas d'épuisement. |
| **Imprécision des Diamètres** | Le diamètre n'est pas mesuré directement, mais déduit de la brillance photométrique (erreur typique de $\pm 50\%$). | Stockage explicite de la fourchette `[diameter_km_min, diameter_km_max]` sans moyenne artificielle trompeuse. |
| **Incomplétude du Catalogue** | Les petits objets (< 50 mètres) ne sont souvent détectés que quelques heures ou jours avant leur périgée. | Conception par batchs journaliers idempotents pour ingérer les révisions sans créer de doublons. |
| **Variabilité des Horodatages** | Les dates peuvent être rapportées en fuseau UTC ou local selon les stations d'observation. | Normalisation stricte au format `YYYY-MM-DD` dans la phase de transformation (`src/transform.py`). |

---

## 3. Stratégie d'Évolution & Montée en Charge

Actuellement, l'architecture SQLite locale satisfait pleinement les besoins analytiques pour des dizaines de milliers d'observations avec une latence quasi-nulle. Si le périmètre s'étend au catalogue complet du Minor Planet Center (> 1,3 million d'astéroïdes) :

1. **Volume Modéré (< 10 millions d'enregistrements)** :
   - Transition vers **DuckDB** : compatibilité binaire immédiate, moteur OLAP vectorisé en mémoire, requêtes analytiques sur fichiers Parquet sans nécessiter de serveur dédié.
2. **Volume Élevé / Multi-utilisateurs concurrents (> 50 millions d'enregistrements)** :
   - Migration vers **PostgreSQL** avec partitionnement temporel par année d'observation (`observed_at`) et extension TimescaleDB pour les trajectoires orbitales.
3. **Partitionnement du Stockage Brut (`data/raw/`)** :
   - Organisation hiérarchique en `data/raw/YYYY/MM/DD/neows_raw_<timestamp>.json` pour éviter la surcharge d'un dossier unique.
