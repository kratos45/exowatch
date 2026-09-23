# ExoWatch

## Objectif
Détecter, parmi les exoplanètes confirmées de la NASA Exoplanet Archive, celles dont les
caractéristiques physiques (rayon, masse, période orbitale) sont statistiquement atypiques
par rapport à la population déjà connue.

## Question centrale
Parmi les exoplanètes confirmées, lesquelles présentent des caractéristiques physiques
statistiquement atypiques par rapport à leur population de référence ?

## Source
NASA Exoplanet Archive — service TAP, table `pscomppars`.
URL : https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name,hostname,discoverymethod,disc_year,pl_orbper,pl_rade,pl_bmasse,st_teff,sy_dist+from+pscomppars&format=csv
Licence : domaine public, attribution NASA/Caltech IPAC recommandée.
Date d'accès : 23/09/2026.

## Prérequis
- Python 3.11+
- Aucune dépendance externe (bibliothèque standard uniquement : csv, statistics, math, json)

## Installation
\`\`\`powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
\`\`\`

## Exécution
\`\`\`powershell
python src\collect.py
python src\transform.py
\`\`\`

## Arborescence
- `data/raw/` — copies brutes horodatées, non modifiées
- `data/curated/dataset.csv` — jeu de données validé, cumulé, avec score d'atypicité
- `data/rejected/rejected_rows.csv` — lignes rejetées avec la raison du rejet
- `reports/` — rapports d'exécution horodatés (JSON)
- `src/` — code du pipeline (collect.py, validate.py, transform.py)

## Règles de qualité
1. `entity_id` (pl_name) ne doit pas être vide
2. `disc_year` doit être compris entre 1995 et l'année en cours
3. `pl_rade` doit être strictement positif si renseigné
4. `pl_orbper` doit être strictement positif si renseigné
5. `entity_id` ne doit pas être dupliqué dans le dataset curated cumulé (upsert)

## Score d'atypicité
Calculé sur rayon, masse et période orbitale (échelle logarithmique, écart à la médiane
normalisé par la MAD), ramené entre 0 et 1 par rapport au maximum observé dans le lot.

## Limites connues
- `pl_orbper` absent pour ~5,5 % des lignes (méthodes Microlensing/Imaging qui ne mesurent
  pas directement la période orbitale)
- `st_teff` absent pour ~4,8 % des lignes (hôtes non stellaires, ex. pulsars)
- Le score d'atypicité est une heuristique statistique simple ; il ne distingue pas un
  phénomène physique réel d'une valeur mal mesurée
- Amélioration future : remplacer ce score par des embeddings AstroCLIP + détection
  d'anomalies par densité pour une caractérisation plus fine