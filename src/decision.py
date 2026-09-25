"""
ExoWatch Decision Layer.
Computes actionable priority scores, historical trajectory trends, and change alerts.
Operates on batch runs to ensure 100% reproducibility and auditability.
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import pandas as pd

from src.db import get_connection


def clamp(val: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Clamps a floating point value between min_val and max_val."""
    return max(min_val, min(max_val, float(val)))


def compute_trend_delta(entity_id: str) -> float:
    """
    Compares the two most recent observations for an entity.
    Returns a normalized trend factor [0.0 - 1.0] where > 0.5 indicates worsening proximity/threat.
    If only one observation exists, returns neutral 0.5.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT miss_distance_km, velocity_kmh, observed_at
            FROM neo_observations
            WHERE entity_id = ?
            ORDER BY observed_at DESC
            LIMIT 2;
        """, (entity_id,))
        rows = [dict(r) for r in cursor.fetchall()]

    if len(rows) < 2:
        return 0.5

    current_obs, previous_obs = rows[0], rows[1]
    curr_dist = float(current_obs.get("miss_distance_km") or 10_000_000)
    prev_dist = float(previous_obs.get("miss_distance_km") or 10_000_000)

    # Relative change in miss distance: if curr_dist < prev_dist, object is getting closer (threat increases)
    if prev_dist > 0:
        dist_rel_change = (prev_dist - curr_dist) / prev_dist
    else:
        dist_rel_change = 0.0

    trend = 0.5 + (dist_rel_change * 0.5)
    return clamp(trend, 0.0, 1.0)


def compute_priority_score(row: Dict[str, Any]) -> float:
    """
    Calculates a composite actionable priority score (0-100).
    Combines proximity (40%), hazard classification (35%), and temporal trend (25%).
    """
    miss_dist = float(row.get("miss_distance_km") or 10_000_000.0)
    proximity_factor = clamp(1.0 - (miss_dist / 10_000_000.0), 0.0, 1.0)
    
    is_haz = int(row.get("is_hazardous") or 0)
    hazard_factor = 1.0 if is_haz == 1 else 0.3
    
    entity_id = str(row.get("entity_id", ""))
    trend_factor = compute_trend_delta(entity_id)

    raw_score = (proximity_factor * 0.40 + hazard_factor * 0.35 + trend_factor * 0.25) * 100.0
    return round(raw_score, 1)


def calculate_and_store_priority_scores(run_id: str) -> List[Dict[str, Any]]:
    """
    Evaluates all distinct NEOs in curated store, calculates composite priority scores,
    and inserts records into the priority_scores table for this run.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        # Retrieve the latest observation for each distinct asteroid
        cursor.execute("""
            SELECT n.*
            FROM neo_observations n
            INNER JOIN (
                SELECT entity_id, MAX(observed_at) as max_obs
                FROM neo_observations
                GROUP BY entity_id
            ) latest ON n.entity_id = latest.entity_id AND n.observed_at = latest.max_obs;
        """)
        observations = [dict(r) for r in cursor.fetchall()]

        if not observations:
            return []

        scored_records = []
        insert_payloads = []
        now_utc = datetime.now(timezone.utc).isoformat()

        for obs in observations:
            score = compute_priority_score(obs)
            entity_id = str(obs["entity_id"])
            insert_payloads.append({
                "entity_id": entity_id,
                "score": score,
                "computed_at": now_utc,
                "run_id": run_id
            })
            scored_records.append({**obs, "priority_score": score})

        cursor.executemany("""
            INSERT INTO priority_scores (entity_id, score, computed_at, run_id)
            VALUES (:entity_id, :score, :computed_at, :run_id);
        """, insert_payloads)
        conn.commit()

    scored_records.sort(key=lambda x: x["priority_score"], reverse=True)
    return scored_records


def get_historical_scores(entity_id: str, limit: int = 6) -> List[float]:
    """Retrieves the history of priority scores for an entity for sparkline rendering."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT score FROM priority_scores
            WHERE entity_id = ?
            ORDER BY computed_at ASC
            LIMIT ?;
        """, (entity_id, limit))
        rows = cursor.fetchall()
        
    if rows:
        return [float(r[0]) for r in rows]
    return [50.0, 50.0]


def detect_threat_changes() -> List[Dict[str, Any]]:
    """
    Identifies objects whose priority scores or threat status experienced significant shifts
    between the last two pipeline runs.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        # Get the two most recent distinct run_ids in priority_scores
        cursor.execute("""
            SELECT DISTINCT run_id, computed_at FROM priority_scores
            ORDER BY computed_at DESC
            LIMIT 2;
        """)
        runs = cursor.fetchall()

        if len(runs) < 2:
            # If only one run exists, highlight asteroids with priority > 65
            cursor.execute("""
                SELECT p.entity_id, n.name, p.score, n.is_hazardous, n.miss_distance_km
                FROM priority_scores p
                JOIN neo_observations n ON p.entity_id = n.entity_id
                WHERE p.score >= 60.0
                ORDER BY p.score DESC
                LIMIT 5;
            """)
            alerts = []
            for r in cursor.fetchall():
                alerts.append({
                    "entity_id": r["entity_id"],
                    "name": r["name"],
                    "change_type": "SURVEILLANCE RENFORCÉE",
                    "delta_score": 0.0,
                    "current_score": r["score"],
                    "description": f"Score d'urgence élevé ({r['score']}/100) — Passage à {r['miss_distance_km']:,.0f} km"
                })
            return alerts

        latest_run, prev_run = runs[0]["run_id"], runs[1]["run_id"]

        cursor.execute("""
            SELECT 
                curr.entity_id,
                n.name,
                curr.score AS curr_score,
                prev.score AS prev_score,
                (curr.score - prev.score) AS delta_score,
                n.is_hazardous
            FROM priority_scores curr
            INNER JOIN priority_scores prev ON curr.entity_id = prev.entity_id
            INNER JOIN neo_observations n ON curr.entity_id = n.entity_id
            WHERE curr.run_id = ? AND prev.run_id = ?
            ORDER BY ABS(curr.score - prev.score) DESC;
        """, (latest_run, prev_run))
        
        changes = []
        for r in cursor.fetchall():
            delta = float(r["delta_score"])
            if abs(delta) >= 2.0 or r["curr_score"] >= 70.0:
                change_type = "HAUSSE DE MENACE" if delta > 0 else "RISQUE DÉCRU"
                if r["curr_score"] >= 75.0:
                    change_type = "ALERTE PRIORITAIRE"

                changes.append({
                    "entity_id": r["entity_id"],
                    "name": r["name"],
                    "change_type": change_type,
                    "delta_score": round(delta, 1),
                    "current_score": round(r["curr_score"], 1),
                    "description": f"Évolution de {delta:+.1f} pts sur le score de priorité (Score actuel : {r['curr_score']:.1f})"
                })

    return changes[:5]
