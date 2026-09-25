"""
FastAPI read-only interface for ExoWatch NEO Intelligence.
Exposes curated asteroid telemetry, priority rankings, and run audit data.
Operates strictly in read-only mode on neo_curated.db.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import sqlite3
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.db import get_db_path

app = FastAPI(
    title="ExoWatch NEO Intelligence API",
    description="Read-only REST API exposing curated asteroid observations, decision priority scores, and ML anomaly telemetry.",
    version="1.0.0"
)

# Enable CORS for external dashboards or frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_ro_connection() -> sqlite3.Connection:
    """Opens a strictly read-only SQLite connection using URI mode=ro."""
    db_path = str(get_db_path().resolve()).replace("\\", "/")
    uri = f"file:{db_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint confirming API service and database connectivity."""
    db_path = get_db_path()
    db_exists = db_path.exists()
    return {
        "status": "healthy" if db_exists else "degraded",
        "database_connected": db_exists,
        "database_file": str(db_path.name)
    }


@app.get("/neo", tags=["Asteroids"])
def list_neo(
    hazardous_only: bool = Query(False, description="Filter only potentially hazardous asteroids"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Pagination offset")
) -> List[Dict[str, Any]]:
    """Lists curated near Earth objects with optional hazardous filter and pagination."""
    query = """
        SELECT observation_id, entity_id, observed_at, name, diameter_km_min,
               diameter_km_max, velocity_kmh, miss_distance_km, is_hazardous,
               absolute_magnitude, orbit_class
        FROM neo_observations
    """
    params = []
    if hazardous_only:
        query += " WHERE is_hazardous = 1"

    query += " ORDER BY observed_at DESC, miss_distance_km ASC LIMIT ? OFFSET ?;"
    params.extend([limit, offset])

    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]

    return rows


@app.get("/neo/{entity_id}", tags=["Asteroids"])
def get_neo_detail(entity_id: str) -> Dict[str, Any]:
    """
    Returns full unified telemetry for a single asteroid:
    observations, sentry risk, AI enrichments, anomaly score, and priority score.
    """
    with get_ro_connection() as conn:
        cursor = conn.cursor()

        # Observations
        cursor.execute("SELECT * FROM neo_observations WHERE entity_id = ? ORDER BY observed_at DESC;", (entity_id,))
        observations = [dict(r) for r in cursor.fetchall()]

        if not observations:
            raise HTTPException(status_code=404, detail=f"Asteroid with entity_id '{entity_id}' not found in curated store.")

        # Sentry scores
        cursor.execute("SELECT * FROM sentry_scores WHERE entity_id = ?;", (entity_id,))
        sentry = [dict(r) for r in cursor.fetchall()]

        # AI Enrichments
        cursor.execute("SELECT * FROM ai_enrichments WHERE entity_id = ? ORDER BY enriched_at DESC;", (entity_id,))
        enrichments = [dict(r) for r in cursor.fetchall()]

        # Anomaly scores
        cursor.execute("SELECT * FROM anomaly_scores WHERE entity_id = ? ORDER BY computed_at DESC LIMIT 1;", (entity_id,))
        anomaly = cursor.fetchone()

        # Priority scores
        cursor.execute("SELECT * FROM priority_scores WHERE entity_id = ? ORDER BY computed_at DESC LIMIT 1;", (entity_id,))
        priority = cursor.fetchone()

        # Orbital elements
        cursor.execute("SELECT * FROM orbital_elements WHERE entity_id = ? LIMIT 1;", (entity_id,))
        orbit = cursor.fetchone()

    return {
        "entity_id": entity_id,
        "name": observations[0]["name"],
        "observations_count": len(observations),
        "latest_observation": observations[0],
        "all_observations": observations,
        "sentry_risks": sentry,
        "ai_enrichments": enrichments,
        "anomaly_analysis": dict(anomaly) if anomaly else None,
        "priority_score": dict(priority) if priority else None,
        "orbital_elements": dict(orbit) if orbit else None
    }


@app.get("/priority/top", tags=["Decision"])
def top_priorities(n: int = Query(10, ge=1, le=50, description="Number of top urgent asteroids to return")) -> List[Dict[str, Any]]:
    """Returns the top N critical asteroids based on the latest composite priority score."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.entity_id, p.score, p.computed_at, n.name, n.miss_distance_km,
                   n.velocity_kmh, n.diameter_km_max, n.is_hazardous, n.orbit_class
            FROM priority_scores p
            JOIN neo_observations n ON p.entity_id = n.entity_id
            WHERE p.run_id = (SELECT run_id FROM priority_scores ORDER BY computed_at DESC LIMIT 1)
            ORDER BY p.score DESC
            LIMIT ?;
        """, (n,))
        rows = [dict(r) for r in cursor.fetchall()]

        if not rows:
            # Fallback to general latest
            cursor.execute("""
                SELECT p.entity_id, p.score, p.computed_at, n.name, n.miss_distance_km,
                       n.velocity_kmh, n.diameter_km_max, n.is_hazardous, n.orbit_class
                FROM priority_scores p
                JOIN neo_observations n ON p.entity_id = n.entity_id
                ORDER BY p.score DESC
                LIMIT ?;
            """, (n,))
            rows = [dict(r) for r in cursor.fetchall()]

    return rows


@app.get("/runs/latest", tags=["Audit"])
def latest_run_report() -> Dict[str, Any]:
    """Returns metadata and quality audit from the most recent pipeline execution batch."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pipeline_runs ORDER BY executed_at DESC LIMIT 1;")
        run_row = cursor.fetchone()

        if not run_row:
            raise HTTPException(status_code=404, detail="No pipeline execution runs found in database.")

        run_dict = dict(run_row)
        run_id = run_dict["run_id"]

        # Fetch rejection sample
        cursor.execute("SELECT rejection_reason, COUNT(*) as count FROM rejected_rows WHERE run_id = ? GROUP BY rejection_reason;", (run_id,))
        rejection_stats = [dict(r) for r in cursor.fetchall()]

    return {
        "run_metadata": run_dict,
        "rejection_summary": rejection_stats
    }
