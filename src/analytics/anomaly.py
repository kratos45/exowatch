"""
Machine learning anomaly detection module for ExoWatch.
Applies Isolation Forest to astrophysical features to identify structurally atypical asteroids.
"""

import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from src.db import get_connection

FEATURE_COLS = [
    "diameter_km_min",
    "diameter_km_max",
    "velocity_kmh",
    "miss_distance_km",
    "absolute_magnitude"
]


def compute_anomaly_scores(df: pd.DataFrame, contamination: float = 0.05) -> pd.DataFrame:
    """
    Computes Isolation Forest anomaly scores on physical features.
    Returns DataFrame with 'anomaly_score' (more negative = more atypical)
    and 'is_anomaly' (boolean flag).
    """
    if df.empty:
        df["anomaly_score"] = []
        df["is_anomaly"] = []
        return df

    result_df = df.copy()

    # Extract and impute features
    X = result_df[FEATURE_COLS].copy()
    for col in FEATURE_COLS:
        X[col] = pd.to_numeric(X[col], errors="coerce")
        median_val = X[col].median()
        if pd.isna(median_val):
            median_val = 1.0
        X[col] = X[col].fillna(median_val)

    if len(X) < 5:
        # Not enough samples for statistical tree isolation
        result_df["anomaly_score"] = 0.0
        result_df["is_anomaly"] = False
        return result_df

    model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=100
    )
    model.fit(X)

    # decision_function gives signed anomaly score: negative for outliers
    scores = model.decision_function(X)
    preds = model.predict(X)  # -1 for anomaly, 1 for inlier

    result_df["anomaly_score"] = np.round(scores, 4)
    result_df["is_anomaly"] = preds == -1
    return result_df


def calculate_and_store_anomaly_scores(run_id: str) -> List[Dict[str, Any]]:
    """
    Runs anomaly detection on latest asteroid observations and records
    results in anomaly_scores table for this run.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT n.entity_id, n.name, n.diameter_km_min, n.diameter_km_max,
                   n.velocity_kmh, n.miss_distance_km, n.absolute_magnitude
            FROM neo_observations n
            INNER JOIN (
                SELECT entity_id, MAX(observed_at) as max_obs
                FROM neo_observations
                GROUP BY entity_id
            ) latest ON n.entity_id = latest.entity_id AND n.observed_at = latest.max_obs;
        """)
        rows = [dict(r) for r in cursor.fetchall()]

    if not rows:
        return []

    df = pd.DataFrame(rows)
    scored_df = compute_anomaly_scores(df)

    insert_payloads = []
    now_utc = datetime.now(timezone.utc).isoformat()

    for _, row in scored_df.iterrows():
        insert_payloads.append({
            "entity_id": str(row["entity_id"]),
            "anomaly_score": float(row["anomaly_score"]),
            "is_anomaly": int(row["is_anomaly"]),
            "run_id": run_id,
            "computed_at": now_utc
        })

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO anomaly_scores (entity_id, anomaly_score, is_anomaly, run_id, computed_at)
            VALUES (:entity_id, :anomaly_score, :is_anomaly, :run_id, :computed_at);
        """, insert_payloads)
        conn.commit()

    return scored_df.sort_values(by="anomaly_score", ascending=True).to_dict(orient="records")
