"""
Database management module for ExoWatch.
Handles SQLite schema creation, connections, views, and migrations.
"""

import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DEFAULT_DB_PATH = Path("data/curated/neo_curated.db")


def get_db_path() -> Path:
    """Return the absolute or relative Path to the curated SQLite database."""
    db_url = os.getenv("DATABASE_URL", str(DEFAULT_DB_PATH))
    if db_url.startswith("sqlite:///"):
        db_url = db_url.replace("sqlite:///", "")
    path = Path(db_url)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def get_connection() -> sqlite3.Connection:
    """Get a SQLite database connection with row factory enabled."""
    db_path = get_db_path()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables, indexes, and views in the SQLite database."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with get_connection() as conn:
        cursor = conn.cursor()

        # 1. neo_observations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS neo_observations (
                observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT NOT NULL,
                observed_at TEXT NOT NULL,
                name TEXT NOT NULL,
                diameter_km_min REAL,
                diameter_km_max REAL,
                velocity_kmh REAL,
                miss_distance_km REAL,
                is_hazardous INTEGER NOT NULL DEFAULT 0,
                absolute_magnitude REAL,
                orbit_class TEXT,
                source_raw_file TEXT NOT NULL,
                loaded_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(entity_id, observed_at)
            );
        """)

        # 2. sentry_scores
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sentry_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT NOT NULL,
                palermo_scale REAL,
                torino_scale INTEGER,
                impact_probability REAL,
                retrieved_at TEXT NOT NULL DEFAULT (datetime('now')),
                source_raw_file TEXT NOT NULL
            );
        """)

        # 3. ai_enrichments
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_enrichments (
                enrichment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT NOT NULL,
                field_enriched TEXT NOT NULL,
                value TEXT NOT NULL,
                confidence REAL NOT NULL,
                model_used TEXT NOT NULL,
                prompt_version TEXT NOT NULL,
                enriched_at TEXT NOT NULL DEFAULT (datetime('now')),
                pipeline_run_id TEXT NOT NULL
            );
        """)

        # 4. pipeline_runs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pipeline_runs (
                run_id TEXT PRIMARY KEY,
                executed_at TEXT NOT NULL DEFAULT (datetime('now')),
                source_file TEXT NOT NULL,
                input_rows INTEGER NOT NULL,
                accepted_rows INTEGER NOT NULL,
                rejected_rows INTEGER NOT NULL,
                duplicates_removed INTEGER NOT NULL,
                quality_status TEXT NOT NULL,
                duration_seconds REAL NOT NULL
            );
        """)

        # 5. rejected_rows
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rejected_rows (
                rejection_id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT,
                raw_payload TEXT NOT NULL,
                rejection_reason TEXT NOT NULL,
                run_id TEXT NOT NULL,
                rejected_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)

        # 6. priority_scores (Decision Layer)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS priority_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT NOT NULL,
                score REAL NOT NULL,
                computed_at TEXT NOT NULL DEFAULT (datetime('now')),
                run_id TEXT NOT NULL
            );
        """)

        # 7. anomaly_scores (Isolation Forest Machine Learning)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS anomaly_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT NOT NULL,
                anomaly_score REAL NOT NULL,
                is_anomaly BOOLEAN NOT NULL,
                run_id TEXT NOT NULL,
                computed_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)

        # 8. agent_queries (Text-to-SQL Assistant Audit)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_queries (
                query_id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                generated_sql TEXT NOT NULL,
                was_valid BOOLEAN NOT NULL,
                row_count INTEGER,
                model_used TEXT NOT NULL,
                asked_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)

        # 9. orbital_elements (Keplerian Orbital Dynamics)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orbital_elements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT NOT NULL,
                semi_major_axis REAL,
                eccentricity REAL,
                inclination REAL,
                ascending_node_longitude REAL,
                perihelion_argument REAL,
                mean_anomaly REAL,
                retrieved_at TEXT NOT NULL DEFAULT (datetime('now')),
                source_raw_file TEXT NOT NULL
            );
        """)

        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_neo_entity_id ON neo_observations(entity_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_entity_id ON ai_enrichments(entity_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sentry_entity_id ON sentry_scores(entity_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pipeline_run_id ON pipeline_runs(run_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_priority_entity_id ON priority_scores(entity_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_priority_run_id ON priority_scores(run_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomaly_entity_id ON anomaly_scores(entity_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomaly_run_id ON anomaly_scores(run_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orbital_entity_id ON orbital_elements(entity_id);")

        # Views
        cursor.execute("DROP VIEW IF EXISTS view_hazardous;")
        cursor.execute("""
            CREATE VIEW view_hazardous AS
            SELECT 
                n.entity_id,
                n.name,
                n.observed_at,
                n.diameter_km_min,
                n.diameter_km_max,
                n.velocity_kmh,
                n.miss_distance_km,
                n.absolute_magnitude,
                n.orbit_class,
                s.palermo_scale,
                s.torino_scale,
                s.impact_probability
            FROM neo_observations n
            LEFT JOIN sentry_scores s ON n.entity_id = s.entity_id
            WHERE n.is_hazardous = 1
            ORDER BY n.miss_distance_km ASC;
        """)

        cursor.execute("DROP VIEW IF EXISTS view_minable;")
        cursor.execute("""
            CREATE VIEW view_minable AS
            SELECT 
                n.entity_id,
                n.name,
                n.diameter_km_max,
                n.velocity_kmh,
                n.miss_distance_km,
                n.orbit_class,
                a.value AS mining_assessment,
                a.confidence,
                a.model_used,
                a.enriched_at
            FROM neo_observations n
            INNER JOIN ai_enrichments a ON n.entity_id = a.entity_id
            WHERE a.field_enriched = 'mining_potential'
            ORDER BY a.confidence DESC;
        """)

        cursor.execute("DROP VIEW IF EXISTS view_data_quality_audit;")
        cursor.execute("""
            CREATE VIEW view_data_quality_audit AS
            SELECT 
                p.run_id,
                p.executed_at,
                p.source_file,
                p.input_rows,
                p.accepted_rows,
                p.rejected_rows,
                p.duplicates_removed,
                p.quality_status,
                p.duration_seconds,
                COUNT(r.rejection_id) AS total_rejections_recorded
            FROM pipeline_runs p
            LEFT JOIN rejected_rows r ON p.run_id = r.run_id
            GROUP BY p.run_id
            ORDER BY p.executed_at DESC;
        """)

        conn.commit()


if __name__ == "__main__":
    init_db()
    print("Database schema and views successfully initialized.")
