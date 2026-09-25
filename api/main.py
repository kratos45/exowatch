"""
FastAPI read-only interface for ExoWatch NEO Intelligence.
Exposes curated asteroid telemetry, decision priority rankings, ML anomaly scores,
predictive forecasts, orbital mechanics parameters, lineage, and Text-to-SQL conversational agent.
Operates strictly in read-only mode on neo_curated.db.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import sqlite3
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.db import get_db_path
from src.decision import detect_threat_changes
from src.analytics.forecast import forecast_priority_trend
from src.agent.text_to_sql import (
    generate_sql, validate_sql, execute_readonly,
    synthesize_answer, log_agent_query
)
from src.reporting.pdf_export import generate_mission_brief_pdf

app = FastAPI(
    title="ExoWatch NEO Intelligence API",
    description="Read-only REST API exposing curated asteroid observations, decision priority scores, ML anomaly telemetry, and Text-to-SQL agent.",
    version="2.0.0"
)

# Enable CORS for Next.js frontend and external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_ro_connection() -> sqlite3.Connection:
    """Opens a strictly read-only SQLite connection using URI mode=ro."""
    db_path = str(get_db_path().resolve()).replace("\\", "/")
    uri = f"file:{db_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


class AgentQueryRequest(BaseModel):
    question: str


# ============================================================================
# 1. SYSTEM & HEALTH
# ============================================================================

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


# ============================================================================
# 2. BRIEFING DU JOUR (MISSION CONTROL)
# ============================================================================

@app.get("/briefing/today", tags=["Mission Control"])
def get_daily_briefing() -> Dict[str, Any]:
    """
    Returns consolidated Mission Control daily briefing:
    - Top 3 priorities with trend sparkline forecasts
    - Latest LLM executive directive synthesis
    - Change alerts (threat escalations/demotions)
    - Mining opportunity of the day (ISRU)
    - Top 5 atypical objects (ML Isolation Forest)
    """
    with get_ro_connection() as conn:
        cursor = conn.cursor()

        # 1. Fetch top 3 priorities
        cursor.execute("""
            SELECT p.entity_id, p.score, p.computed_at, n.name, n.miss_distance_km,
                   n.velocity_kmh, n.diameter_km_max, n.is_hazardous, n.orbit_class,
                   n.observed_at
            FROM priority_scores p
            JOIN neo_observations n ON p.entity_id = n.entity_id
            ORDER BY p.computed_at DESC, p.score DESC
            LIMIT 3;
        """)
        top3_rows = [dict(r) for r in cursor.fetchall()]

        # Enrich each top priority with polynomial forecast trend
        top3_enriched = []
        for item in top3_rows:
            entity_id = item["entity_id"]
            trend = forecast_priority_trend(entity_id)
            cursor.execute("SELECT value FROM ai_enrichments WHERE entity_id = ? AND field_enriched = 'summary' ORDER BY enriched_at DESC LIMIT 1;", (entity_id,))
            s_row = cursor.fetchone()
            cursor.execute("SELECT value FROM ai_enrichments WHERE entity_id = ? AND field_enriched = 'urgency' ORDER BY enriched_at DESC LIMIT 1;", (entity_id,))
            u_row = cursor.fetchone()
            item["trend_forecast"] = trend
            item["ai_summary"] = s_row["value"] if s_row else "Observation instrumentale nominale."
            item["urgency"] = u_row["value"] if u_row else "Modérée"
            top3_enriched.append(item)

        # 2. Latest run executive brief
        cursor.execute("SELECT run_id, executed_at, input_rows, accepted_rows, duration_seconds FROM pipeline_runs ORDER BY executed_at DESC LIMIT 1;")
        run_row = cursor.fetchone()
        latest_run = dict(run_row) if run_row else None

        # 3. Top mining opportunity (view_minable)
        cursor.execute("""
            SELECT entity_id, name, diameter_km_max, velocity_kmh, miss_distance_km,
                   orbit_class, mining_assessment, confidence, model_used
            FROM view_minable
            ORDER BY confidence DESC, diameter_km_max DESC
            LIMIT 1;
        """)
        mining_row = cursor.fetchone()
        mining_opp = dict(mining_row) if mining_row else None

        # 4. Top 5 atypical objects (anomaly_scores)
        cursor.execute("""
            SELECT a.entity_id, n.name, a.anomaly_score, a.is_anomaly,
                   n.diameter_km_max, n.velocity_kmh, n.miss_distance_km, n.absolute_magnitude
            FROM anomaly_scores a
            JOIN neo_observations n ON a.entity_id = n.entity_id
            WHERE a.run_id = (SELECT run_id FROM anomaly_scores ORDER BY computed_at DESC LIMIT 1)
            ORDER BY a.anomaly_score ASC
            LIMIT 5;
        """)
        atypical = [dict(r) for r in cursor.fetchall()]
        if not atypical:
            cursor.execute("""
                SELECT a.entity_id, n.name, a.anomaly_score, a.is_anomaly,
                       n.diameter_km_max, n.velocity_kmh, n.miss_distance_km, n.absolute_magnitude
                FROM anomaly_scores a
                JOIN neo_observations n ON a.entity_id = n.entity_id
                ORDER BY a.anomaly_score ASC
                LIMIT 5;
            """)
            atypical = [dict(r) for r in cursor.fetchall()]

    # 5. Threat change alerts
    change_alerts = detect_threat_changes()

    return {
        "status": "success",
        "latest_run": latest_run,
        "top_priorities": top3_enriched,
        "mining_highlight": mining_opp,
        "atypical_objects": atypical,
        "change_alerts": change_alerts
    }


# ============================================================================
# 3. ASTEROIDS & TELEMETRY
# ============================================================================

@app.get("/neo", tags=["Asteroids"])
def list_neo(
    hazardous_only: bool = Query(False, description="Filter only potentially hazardous asteroids"),
    min_anomaly: Optional[float] = Query(None, description="Filter by minimum anomaly score"),
    search: Optional[str] = Query(None, description="Search by name or entity_id"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Pagination offset")
) -> List[Dict[str, Any]]:
    """Lists curated near Earth objects with optional filters, anomaly scores, and pagination."""
    query = """
        SELECT n.observation_id, n.entity_id, n.observed_at, n.name, n.diameter_km_min,
               n.diameter_km_max, n.velocity_kmh, n.miss_distance_km, n.is_hazardous,
               n.absolute_magnitude, n.orbit_class, s.palermo_scale, s.torino_scale,
               a.anomaly_score, a.is_anomaly, p.score as priority_score
        FROM neo_observations n
        LEFT JOIN sentry_scores s ON n.entity_id = s.entity_id
        LEFT JOIN (
            SELECT entity_id, anomaly_score, is_anomaly FROM anomaly_scores
            GROUP BY entity_id HAVING MAX(computed_at)
        ) a ON n.entity_id = a.entity_id
        LEFT JOIN (
            SELECT entity_id, score FROM priority_scores
            GROUP BY entity_id HAVING MAX(computed_at)
        ) p ON n.entity_id = p.entity_id
        WHERE 1=1
    """
    params = []
    if hazardous_only:
        query += " AND n.is_hazardous = 1"
    if search:
        query += " AND (n.name LIKE ? OR n.entity_id LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    if min_anomaly is not None:
        query += " AND a.anomaly_score <= ?"
        params.append(min_anomaly)

    query += " ORDER BY n.observed_at DESC, n.miss_distance_km ASC LIMIT ? OFFSET ?;"
    params.extend([limit, offset])

    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]

    return rows


@app.get("/neo/{entity_id}", tags=["Asteroids"])
def get_neo_detail(entity_id: str) -> Dict[str, Any]:
    """Returns full unified telemetry for a single asteroid."""
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

    trend = forecast_priority_trend(entity_id)

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
        "orbital_elements": dict(orbit) if orbit else None,
        "trend_forecast": trend
    }


@app.get("/neo/{entity_id}/anomaly", tags=["Analytics"])
def get_anomaly(entity_id: str) -> Dict[str, Any]:
    """Returns anomaly detection scores computed by Isolation Forest."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM anomaly_scores WHERE entity_id = ? ORDER BY computed_at DESC LIMIT 1;", (entity_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"No anomaly score computed for entity '{entity_id}'.")
    return dict(row)


@app.get("/neo/{entity_id}/forecast", tags=["Analytics"])
def get_forecast(entity_id: str, window: int = Query(5, ge=2, le=20)) -> Dict[str, Any]:
    """Returns linear regression trend forecast on historical priority scores."""
    return forecast_priority_trend(entity_id, window=window)


@app.get("/neo/{entity_id}/orbit", tags=["Orbit 3D"])
def get_orbital_elements(entity_id: str) -> Dict[str, Any]:
    """Returns classical Keplerian orbital elements (a, e, i, Ω, ω, M) with asteroid metadata."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT o.*, n.name, n.is_hazardous, n.velocity_kmh, n.diameter_km_max, n.miss_distance_km
            FROM orbital_elements o
            JOIN neo_observations n ON o.entity_id = n.entity_id
            WHERE o.entity_id = ?
            LIMIT 1;
        """, (entity_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Orbital elements not available for entity '{entity_id}'.")
    return dict(row)


@app.get("/neo/orbits/all", tags=["Orbit 3D"])
def get_all_orbits(limit: int = Query(100, ge=1, le=500)) -> List[Dict[str, Any]]:
    """Returns Keplerian orbital elements for a batch of asteroids for 3D visualization."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT o.*, n.is_hazardous, n.velocity_kmh, n.diameter_km_max, n.miss_distance_km
            FROM orbital_elements o
            JOIN neo_observations n ON o.entity_id = n.entity_id
            GROUP BY o.entity_id
            LIMIT ?;
        """, (limit,))
        return [dict(r) for r in cursor.fetchall()]


@app.get("/neo/{entity_id}/trace", tags=["Lineage & Traceability"])
def get_lineage(entity_id: str) -> Dict[str, Any]:
    """Returns complete end-to-end data lineage and audit history for an asteroid."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM neo_observations WHERE entity_id = ? ORDER BY observed_at ASC;", (entity_id,))
        observations = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM ai_enrichments WHERE entity_id = ? ORDER BY enriched_at ASC;", (entity_id,))
        enrichments = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM rejected_rows WHERE raw_payload LIKE ? ORDER BY rejected_at ASC;", (f"%{entity_id}%",))
        rejections = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM priority_scores WHERE entity_id = ? ORDER BY computed_at ASC;", (entity_id,))
        priorities = [dict(r) for r in cursor.fetchall()]

    return {
        "entity_id": entity_id,
        "observations": observations,
        "ai_enrichments": enrichments,
        "rejections": rejections,
        "priority_history": priorities
    }


# ============================================================================
# 4. DECISION & MINING
# ============================================================================

@app.get("/priority/top", tags=["Decision"])
def top_priorities(n: int = Query(10, ge=1, le=50)) -> List[Dict[str, Any]]:
    """Returns the top N critical asteroids based on the latest composite priority score."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.entity_id, p.score, p.computed_at, n.name, n.miss_distance_km,
                   n.velocity_kmh, n.diameter_km_max, n.is_hazardous, n.orbit_class
            FROM priority_scores p
            JOIN neo_observations n ON p.entity_id = n.entity_id
            ORDER BY p.computed_at DESC, p.score DESC
            LIMIT ?;
        """, (n,))
        return [dict(r) for r in cursor.fetchall()]


@app.get("/mining", tags=["Mining"])
def list_mining_candidates(
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=200)
) -> List[Dict[str, Any]]:
    """Returns space mining opportunities evaluated by ISRU criteria from view_minable."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM view_minable
            WHERE confidence >= ?
            ORDER BY confidence DESC, diameter_km_max DESC
            LIMIT ?;
        """, (min_confidence, limit))
        return [dict(r) for r in cursor.fetchall()]


# ============================================================================
# 5. TEXT-TO-SQL CONVERSATIONAL AGENT
# ============================================================================

@app.post("/agent/query", tags=["AI Agent"])
def agent_query(req: AgentQueryRequest) -> Dict[str, Any]:
    """
    Translates a natural language question into safe read-only SQL, executes it,
    and returns a synthesized natural language answer.
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    sql, model_used = generate_sql(question)
    is_valid, validation_msg = validate_sql(sql)

    if not is_valid:
        log_agent_query(question, sql, False, 0, model_used)
        return {
            "question": question,
            "sql": sql,
            "is_valid": False,
            "row_count": 0,
            "answer": f"Requête rejetée par le garde-fou de sécurité : {validation_msg}",
            "data": []
        }

    try:
        df = execute_readonly(sql)
        row_count = len(df)
        answer = synthesize_answer(question, df)
        log_agent_query(question, sql, True, row_count, model_used)
        return {
            "question": question,
            "sql": sql,
            "is_valid": True,
            "row_count": row_count,
            "answer": answer,
            "data": df.head(50).to_dict(orient="records")
        }
    except Exception as e:
        log_agent_query(question, sql, False, 0, model_used)
        return {
            "question": question,
            "sql": sql,
            "is_valid": False,
            "row_count": 0,
            "answer": f"Erreur lors de l'exécution SQL : {str(e)}",
            "data": []
        }


# ============================================================================
# 6. OBSERVABILITY & PDF REPORTS
# ============================================================================

@app.get("/runs/latest", tags=["Audit"])
def latest_run_report() -> Dict[str, Any]:
    """Returns metadata and quality audit from the most recent pipeline execution batch."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pipeline_runs ORDER BY executed_at DESC LIMIT 1;")
        run_row = cursor.fetchone()
        if not run_row:
            raise HTTPException(status_code=404, detail="No pipeline execution runs found.")
        run_dict = dict(run_row)
        run_id = run_dict["run_id"]

        cursor.execute("SELECT rejection_reason, COUNT(*) as count FROM rejected_rows WHERE run_id = ? GROUP BY rejection_reason;", (run_id,))
        rejection_stats = [dict(r) for r in cursor.fetchall()]

    return {
        "run_metadata": run_dict,
        "rejection_summary": rejection_stats
    }


@app.get("/reports/latest", tags=["Audit"])
def list_latest_reports(limit: int = Query(10, ge=1, le=50)) -> List[Dict[str, Any]]:
    """Lists historical execution runs with audit and quality metrics."""
    with get_ro_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pipeline_runs ORDER BY executed_at DESC LIMIT ?;", (limit,))
        runs = [dict(r) for r in cursor.fetchall()]
        for r in runs:
            cursor.execute("SELECT COUNT(*) FROM rejected_rows WHERE run_id = ?;", (r["run_id"],))
            r["rejected_count"] = cursor.fetchone()[0]
    return runs


@app.get("/reports/{run_id}/pdf", tags=["Audit"])
def download_pdf(run_id: str):
    """Generates and streams executive mission briefing PDF report."""
    try:
        pdf_path = generate_mission_brief_pdf(run_id)
        if not pdf_path.exists():
            raise HTTPException(status_code=500, detail="PDF generation failed.")
        return FileResponse(
            path=str(pdf_path),
            filename=f"brief_{run_id}.pdf",
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")
