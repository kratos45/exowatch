# Modèle Entité-Association (ER Diagram) — ExoWatch Curated Store

Ce document présente l'architecture de la base de données relationnelle locale (`neo_curated.db` sous SQLite), conçue pour garantir la traçabilité intégrale, l'idempotence stricte et l'isolation des données mesurées et inférées.

---

## 1. Diagramme Mermaid

```mermaid
erDiagram
    neo_observations ||--o{ sentry_scores : "a pour scores d'impact"
    neo_observations ||--o{ ai_enrichments : "fait l'objet d'évaluations IA"
    pipeline_runs ||--o{ rejected_rows : "génère des rejets"
    pipeline_runs ||--o{ ai_enrichments : "trace le run d'inférence"

    neo_observations {
        INTEGER observation_id PK "Auto-incrémenté"
        TEXT entity_id "Identifiant NASA NeoWS (ex: 2000433)"
        TEXT observed_at "Date de passage (YYYY-MM-DD)"
        TEXT name "Nom officiel de l'astéroïde"
        REAL diameter_km_min "Diamètre min estimé (km)"
        REAL diameter_km_max "Diamètre max estimé (km)"
        REAL velocity_kmh "Vitesse relative (km/h)"
        REAL miss_distance_km "Distance minimale de croisement (km)"
        INTEGER is_hazardous "Indicateur binaire de dangerosité (0/1)"
        REAL absolute_magnitude "Magnitude absolue H"
        TEXT orbit_class "Famille d'orbite (Apollo, Aten, etc.)"
        TEXT source_raw_file "Nom du fichier JSON brut d'origine"
        TEXT loaded_at "Horodatage d'insertion UTC"
    }

    sentry_scores {
        INTEGER id PK "Auto-incrémenté"
        TEXT entity_id "Identifiant astéroïde lié"
        REAL palermo_scale "Indice cumulé de Palerme"
        INTEGER torino_scale "Niveau sur l'échelle de Turin (0-10)"
        REAL impact_probability "Probabilité estimée d'impact terrestre"
        TEXT retrieved_at "Horodatage de collecte"
        TEXT source_raw_file "Fichier brut Sentry"
    }

    ai_enrichments {
        INTEGER enrichment_id PK "Auto-incrémenté"
        TEXT entity_id "Identifiant astéroïde lié"
        TEXT field_enriched "Attribut qualifié (ex: mining_potential)"
        TEXT value "Valeur générée par le modèle"
        REAL confidence "Score de confiance normalisé [0.0 - 1.0]"
        TEXT model_used "Identifiant du modèle (ex: gemini-2.0-flash)"
        TEXT prompt_version "Version du prompt (ex: v1.2)"
        TEXT enriched_at "Horodatage d'inférence UTC"
        TEXT pipeline_run_id "Clé étrangère vers pipeline_runs"
    }

    pipeline_runs {
        TEXT run_id PK "UUID v4 unique du run"
        TEXT executed_at "Horodatage de déclenchement UTC"
        TEXT source_file "Fichier source principal traité"
        INTEGER input_rows "Nombre d'enregistrements bruts reçus"
        INTEGER accepted_rows "Nombre de lignes validées et insérées"
        INTEGER rejected_rows "Nombre de lignes rejetées sous contrat"
        INTEGER duplicates_removed "Nombre de doublons évincés"
        TEXT quality_status "Statut global : PASSED / WARNING / FAILED"
        REAL duration_seconds "Durée totale d'exécution (secondes)"
    }

    rejected_rows {
        INTEGER rejection_id PK "Auto-incrémenté"
        TEXT entity_id "Identifiant si disponible"
        TEXT raw_payload "Contenu JSON brut de la ligne en échec"
        TEXT rejection_reason "Code et description de la règle violée"
        TEXT run_id "UUID du run ayant rejeté la donnée"
        TEXT rejected_at "Horodatage du rejet UTC"
    }
```

---

## 2. Dictionnaire des Tables et Clés

### `neo_observations`
- **Rôle** : Référentiel des observations validées d'astéroïdes proches de la Terre.
- **Clé Métier & Contrainte d'Unicité** : `UNIQUE(entity_id, observed_at)`
  - Permet à un astéroïde d'avoir plusieurs passages documentés à des dates différentes.
  - Empêche strictement l'insertion de doublons lors de la ré-exécution du pipeline (principe d'idempotence via SQLite UPSERT).

### `sentry_scores`
- **Rôle** : Suivi des risques d'impact selon les systèmes d'alerte automatisés de la NASA/JPL.
- **Liaison** : Rattaché logiquement par `entity_id`.

### `ai_enrichments`
- **Rôle** : Historisation immuable des estimations de potentiel d'exploitation minière et d'in-situ resource utilization (ISRU) dérivées par LLM.
- **Traçabilité** : Chaque enregistrement conserve la version exacte du prompt (`prompt_version`), le modèle d'inférence (`model_used`) et le run d'exécution (`pipeline_run_id`).

### `pipeline_runs`
- **Rôle** : Journal d'audit chronologique de tous les batchs d'ingestion.
- **Clé Primaire** : `run_id` (UUID4).

### `rejected_rows`
- **Rôle** : Zone de quarantaine documentée recueillant toute ligne ayant enfreint le contrat de données (R1, R2, R3, R6). Conserve le payload brut pour analyse et rejeu ultérieur.

---

## 3. Justification de la Séparation stricte : Mesuré vs Inféré

> **Principe Pédagogique Fondamental (Règle n°5)** : Ne jamais mélanger les observations physiques issues d'instruments scientifiques avec des données inférées par des modèles d'intelligence artificielle statistique.

1. **Intégrité Scientifique** : Les colonnes de `neo_observations` représentent des mesures astronomiques directes (photométrie, radar de Goldstone, astrométrie). Aucune inférence probabiliste ne doit altérer ou masquer ces métriques.
2. **Évolution & Reproductibilité des Modèles** : Les LLM évoluent rapidement. Séparer `ai_enrichments` permet de ré-inférer les caractéristiques d'un astéroïde avec un nouveau modèle (`model_used`) ou une nouvelle variante de prompt (`prompt_version`) sans toucher aux données sources.
3. **Auditabilité des Décisions** : Les utilisateurs et analystes peuvent examiner le score de confiance (`confidence`) et la justification scientifique de manière isolée sans créer de biais dans les filtres de sécurité planétaire.
