import sqlite3
from pathlib import Path

DB_FILE = Path("data/curated/exowatch.db")

def get_connection():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Table pour les exoplanètes
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exoplanets (
            entity_id TEXT PRIMARY KEY,
            observed_at TEXT,
            hostname TEXT,
            discoverymethod TEXT,
            disc_year INTEGER,
            pl_orbper REAL,
            pl_rade REAL,
            pl_bmasse REAL,
            st_teff REAL,
            sy_dist REAL,
            anomaly_score_heuristic REAL,
            anomaly_score_ml REAL
        )
    """)
    
    # Table pour les objets géocroiseurs (NEOs)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS neo_objects (
            entity_id TEXT PRIMARY KEY,
            observed_at TEXT,
            name TEXT,
            semi_major_axis REAL,
            eccentricity REAL,
            orbital_period REAL,
            perihelion_distance REAL,
            aphelion_distance REAL,
            is_potentially_hazardous_asteroid INTEGER
        )
    """)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print(f"Base de données initialisée : {DB_FILE}")
