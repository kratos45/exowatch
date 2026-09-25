# Prompt pour Coding Agent — ExoWatch NEO Intelligence (v3, conforme TP ESEO)

Copie-colle ce document tel quel à ton agent (Claude Code, Cursor, etc.). Il contient tout : environnement, structure, schéma de base, pipeline, règles qualité, traçabilité et interface graphique.

---

## 0. Contexte du projet

Construire **ExoWatch NEO Intelligence**, une application de collecte et d'analyse d'objets géocroiseurs (NEO — Near-Earth Objects), conforme au cadre pédagogique suivant :
- Pipeline batch reproductible (raw → validation → curated)
- 5 règles de qualité automatisées minimum
- Zone raw immuable + zone rejected documentée
- Idempotence garantie (rejouer le pipeline ne duplique rien)
- Traçabilité complète de toute donnée enrichie par IA
- Rapport d'exécution JSON à chaque run
- README reproductible par un tiers

**Ne pas** sur-architecturer : pas de Neo4j, pas de Kafka, pas de microservices pour cette version. SQLite + Python + une interface Streamlit légère suffisent et sont justifiables dans la matrice SQL/NoSQL et Batch/Streaming du TP (accès en agrégats simples, fraîcheur quotidienne, équipe réduite = un script planifié + base SQL est proportionné).

---

## 1. Environnement virtuel et installation

```bash
# Créer le projet
mkdir exowatch-neo && cd exowatch-neo
python3 -m venv .venv

# Activer (Linux/Mac)
source .venv/bin/activate
# Activer (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Installer les dépendances
pip install -r requirements.txt
```

**Contenu de `requirements.txt`** :
```
requests==2.32.3
python-dotenv==1.0.1
pandas==2.2.3
pydantic==2.9.2
pyyaml==6.0.2
streamlit==1.39.0
plotly==5.24.1
openai==1.54.0
pytest==8.3.3
sqlalchemy==2.0.36
```

**Fichier `.env` (jamais commité, voir `.gitignore`)** :
```
NASA_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

**`.gitignore`** :
```
.venv/
__pycache__/
.env
*.log
data/raw/*.json
!data/raw/sample_source.json
*.db-journal
```

---

## 2. Structure du dépôt

```
exowatch-neo/
├── README.md
├── requirements.txt
├── .gitignore
├── .env.example
├── config/
│   └── data_contract.yaml
├── data/
│   ├── raw/                     # copies brutes horodatées, immuables
│   ├── curated/                 # neo_curated.db (SQLite)
│   └── rejected/                # lignes rejetées + cause
├── docs/
│   ├── architecture.png
│   ├── source_assessment.md
│   └── er_diagram.md
├── reports/
│   └── run_report_<timestamp>.json
├── src/
│   ├── collect.py               # appel API NeoWs + Sentry
│   ├── profile_data.py          # profilage avant nettoyage
│   ├── validate.py              # 5+ règles de qualité
│   ├── transform.py             # nettoyage, typage, dédup
│   ├── enrich.py                # enrichissement LLM + traçabilité
│   ├── db.py                    # connexion SQLite, création schéma
│   ├── pipeline.py              # orchestrateur (idempotent)
│   └── app.py                   # interface Streamlit
├── tests/
│   ├── test_quality.py
│   └── test_idempotence.py
└── .streamlit/
    └── config.toml
```

---

## 3. Contrat de données (`config/data_contract.yaml`)

```yaml
dataset: neo_observations
version: 1.0
grain: "une ligne represente une observation d'un objet geocroiseur a une date de collecte donnee"
owner: hamza
required_fields:
  - observed_at
  - entity_id
  - diameter_km_min
  - diameter_km_max
  - velocity_kmh
  - miss_distance_km
  - is_hazardous
quality_rules:
  - name: entity_id_not_null
    field: entity_id
    condition: not_null
    action: reject
  - name: observed_at_valid_date
    field: observed_at
    condition: is_valid_datetime
    action: reject
  - name: diameter_positive
    field: diameter_km_min
    condition: "value > 0"
    action: reject
  - name: velocity_plausible_range
    field: velocity_kmh
    condition: "0 < value < 200000"
    action: flag
  - name: unique_business_key
    field: [entity_id, observed_at]
    condition: no_duplicate
    action: deduplicate
  - name: miss_distance_positive
    field: miss_distance_km
    condition: "value >= 0"
    action: reject
```

---

## 4. Schéma de base de données et relations (SQLite — `data/curated/neo_curated.db`)

### Tables

```sql
-- Table centrale : une ligne = une observation d'un NEO à une date de collecte
CREATE TABLE neo_observations (
    observation_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id           TEXT NOT NULL,
    observed_at          DATETIME NOT NULL,
    name                 TEXT,
    diameter_km_min      REAL NOT NULL,
    diameter_km_max      REAL NOT NULL,
    velocity_kmh         REAL NOT NULL,
    miss_distance_km     REAL NOT NULL,
    is_hazardous         BOOLEAN NOT NULL,
    absolute_magnitude   REAL,
    orbit_class          TEXT,
    source_raw_file      TEXT NOT NULL,          -- traçabilité vers le fichier raw
    UNIQUE(entity_id, observed_at)                -- clé métier -> idempotence
);

-- Score de risque officiel JPL Sentry (source B), relié 1-à-1 ou 1-à-plusieurs par entity_id
CREATE TABLE sentry_scores (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id            TEXT NOT NULL,
    palermo_scale        REAL,
    torino_scale         INTEGER,
    impact_probability    REAL,
    retrieved_at          DATETIME NOT NULL,
    source_raw_file       TEXT NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES neo_observations(entity_id)
);

-- Enrichissements générés par IA : matière, porosité, exploitabilité
-- Séparée de neo_observations pour ne JAMAIS mélanger donnée mesurée et donnée inférée
CREATE TABLE ai_enrichments (
    enrichment_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id             TEXT NOT NULL,
    field_enriched         TEXT NOT NULL,          -- ex: 'material_prediction', 'porosity_score'
    value                  TEXT NOT NULL,
    confidence             REAL,                    -- 0.0 a 1.0
    model_used             TEXT NOT NULL,           -- ex: 'gpt-4o-mini'
    prompt_version         TEXT NOT NULL,           -- ex: 'v1.0'
    enriched_at            DATETIME NOT NULL,
    pipeline_run_id        TEXT NOT NULL,           -- lien vers pipeline_runs.run_id
    FOREIGN KEY (entity_id) REFERENCES neo_observations(entity_id),
    FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(run_id)
);

-- Journal de chaque exécution du pipeline (traçabilité + idempotence)
CREATE TABLE pipeline_runs (
    run_id                TEXT PRIMARY KEY,          -- uuid
    executed_at            DATETIME NOT NULL,
    source_file             TEXT NOT NULL,
    input_rows              INTEGER NOT NULL,
    accepted_rows            INTEGER NOT NULL,
    rejected_rows            INTEGER NOT NULL,
    duplicates_removed        INTEGER NOT NULL,
    quality_status            TEXT NOT NULL,          -- PASS / PASS_WITH_WARNINGS / FAIL
    duration_seconds          REAL NOT NULL
);

-- Lignes rejetées, avec cause explicite (jamais de suppression silencieuse)
CREATE TABLE rejected_rows (
    rejection_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id                TEXT,
    raw_payload               TEXT NOT NULL,          -- JSON brut de la ligne
    rejection_reason           TEXT NOT NULL,          -- quelle regle a echoue
    run_id                     TEXT NOT NULL,
    rejected_at                 DATETIME NOT NULL,
    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id)
);
```

### Relations (résumé)
- `neo_observations.entity_id` ← référencé par `sentry_scores`, `ai_enrichments` (1 objet → plusieurs observations/scores/enrichissements dans le temps)
- `pipeline_runs.run_id` ← référencé par `ai_enrichments` et `rejected_rows` (traçabilité de chaque run)
- Pas de duplication de données entre tables : **des vues SQL** remplacent les "sous-bases par catégorie" pour éviter la redondance :

```sql
CREATE VIEW view_hazardous AS
SELECT * FROM neo_observations WHERE is_hazardous = 1;

CREATE VIEW view_minable AS
SELECT o.*, e.value AS material, e.confidence AS material_confidence
FROM neo_observations o
JOIN ai_enrichments e ON o.entity_id = e.entity_id
WHERE e.field_enriched = 'material_prediction'
  AND e.value IN ('Fer', 'Nickel', 'Silicate');

CREATE VIEW view_data_quality_audit AS
SELECT run_id, executed_at, accepted_rows, rejected_rows, quality_status
FROM pipeline_runs ORDER BY executed_at DESC;
```

Génère un diagramme ER (mermaid) dans `docs/er_diagram.md` à partir de ce schéma.

---

## 5. Pipeline ETL — comportement attendu de chaque script

### `src/collect.py`
- Fonction `collect(url, params) -> Path` : appelle l'API, gère les erreurs (`try/except` sur `requests`, timeout 20s), écrit le JSON brut tel quel dans `data/raw/source_<entity>_<timestamp>.json`, ne modifie jamais la réponse.
- Deux fonctions : `collect_neows()` et `collect_sentry()`.
- Aucun secret en clair : clés lues via `os.getenv()`.

### `src/profile_data.py`
- Avant nettoyage : affiche shape, dtypes, % de valeurs manquantes, doublons, min/max, modalités fréquentes. Sauvegarde dans `reports/profile_<timestamp>.txt`.

### `src/validate.py`
- Implémente les 6 règles du `data_contract.yaml` sous forme de fonctions pures testables : `check_entity_id_not_null(df)`, etc.
- Chaque règle retourne `(mask_valid: pd.Series, reason: str)`.
- Sépare `accepted` et `rejected`, ajoute une colonne `rejection_reason` sur les rejetés — ne jamais les supprimer silencieusement.

### `src/transform.py`
- Typage strict (datetime UTC, float, bool).
- Déduplication sur la clé métier `(entity_id, observed_at)`.
- Renommage/normalisation des colonnes NASA → schéma cible.

### `src/enrich.py`
- Appelle le LLM (via `OPENAI_API_KEY` / `OPENAI_BASE_URL`) pour prédire `material_prediction`, `porosity_score`, `is_exploitable`, chacun avec un score de confiance.
- **Chaque appel écrit une ligne dans `ai_enrichments`** avec `model_used`, `prompt_version`, `pipeline_run_id` — jamais d'écriture directe dans `neo_observations`.
- Prompt système strict imposant une sortie JSON structurée (`{"material": "...", "confidence": 0.0-1.0, "reasoning": "..."}`).

### `src/pipeline.py`
- Orchestre : `collect → profile → validate → transform → load (idempotent, UPSERT via clé unique) → enrich → generate_report`.
- Génère un `run_id` (uuid4) unique par exécution, écrit `reports/run_report_<run_id>.json` au format :
```json
{
  "run_id": "...",
  "executed_at": "...",
  "source_file": "...",
  "input_rows": 0,
  "accepted_rows": 0,
  "rejected_rows": 0,
  "duplicates_removed": 0,
  "quality_status": "PASS_WITH_WARNINGS",
  "duration_seconds": 0.0
}
```
- **Test d'idempotence obligatoire** : exécuter le pipeline deux fois sur le même fichier raw ne doit ajouter aucune nouvelle ligne dans `neo_observations` (vérifié par `UNIQUE(entity_id, observed_at)` + `INSERT OR IGNORE` / UPSERT).

---

## 6. Interface graphique (`src/app.py` — Streamlit)

Choix assumé : **Streamlit** plutôt que Next.js/FastAPI pour cette version — objectif TP (démontrable en quelques heures, pas de sur-ingénierie). Si tu veux migrer vers l'interface "cockpit" Next.js plus tard, cette base SQLite curated devient simplement la source de données de l'API FastAPI.

Pages (multipage Streamlit, dossier `pages/`) :

1. **`app.py` — Dashboard**
   - KPIs : nb objets suivis, nb objets dangereux (`is_hazardous`), dernier run, taux de rejet du dernier run
   - Graphique Plotly : distribution des vélocités / distances
   - Tableau des 10 derniers runs (`view_data_quality_audit`)

2. **`pages/1_Objets_dangereux.py`**
   - Table filtrable de `view_hazardous`
   - Sélection d'un objet → détail (diamètre, vitesse, distance, score Sentry)

3. **`pages/2_Exploitation_miniere.py`**
   - Table de `view_minable` avec matériau prédit + badge de confiance coloré (vert >80%, orange 50-80%, rouge <50%)

4. **`pages/3_Tracabilite.py`**
   - Recherche par `entity_id` → historique complet : observations dans le temps, tous les enrichissements IA avec `model_used`, `prompt_version`, `enriched_at`, `pipeline_run_id`
   - Répond directement à la question de soutenance "comment savez-vous que le pipeline n'a pas traité deux fois la même donnée"

5. **`pages/4_Rapports_execution.py`**
   - Liste des `run_report_*.json`, visualisation du taux d'acceptation/rejet par run (barre empilée Plotly)

Lancement :
```bash
streamlit run src/app.py
```

---

## 7. Tests (`tests/`)

- `test_quality.py` : teste chaque règle de `validate.py` avec des cas limites (valeur nulle, date invalide, doublon, valeur hors plage).
- `test_idempotence.py` : charge le même fichier raw deux fois, vérifie que `COUNT(*)` dans `neo_observations` ne change pas au second run.

```bash
pytest tests/ -v
```

---

## 8. README.md — contenu attendu

Le README doit inclure, dans cet ordre : objectif, question centrale, utilisateur cible, source et licence des données (NASA = domaine public), prérequis, installation (copier la section 1 de ce prompt), commande d'exécution du pipeline, commande de lancement de l'interface, arborescence du dépôt, les 6 règles de qualité avec leur action, stratégie d'idempotence, et une section "Limites connues et améliorations futures" (ex : passage à une architecture streaming si alertes temps réel requises — cf. scénario B du TD séance 3).

---

## 9. Ordre d'implémentation recommandé pour l'agent

1. Créer la structure de dossiers + venv + `requirements.txt`
2. `config/data_contract.yaml`
3. `src/db.py` (création du schéma SQLite ci-dessus)
4. `src/collect.py` + premier fichier raw réel
5. `src/profile_data.py`
6. `src/validate.py` + `tests/test_quality.py`
7. `src/transform.py`
8. `src/pipeline.py` (orchestrateur, sans enrichissement d'abord) + `tests/test_idempotence.py`
9. `src/enrich.py` (ajout de l'enrichissement LLM + table `ai_enrichments`)
10. `src/app.py` + pages Streamlit
11. `README.md` + `docs/er_diagram.md` + `docs/source_assessment.md`
12. Génération d'un `reports/run_report_*.json` de démonstration

Implémente dans cet ordre, en validant chaque étape avant de passer à la suivante.
