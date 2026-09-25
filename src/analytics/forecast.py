"""
Trend forecasting module for ExoWatch.
Performs linear regression extrapolation on temporal priority scores.
"""

from typing import Dict, Any, List
import numpy as np

from src.db import get_connection


def forecast_priority_trend(entity_id: str, window: int = 5) -> Dict[str, Any]:
    """
    Fits degree 1 polynomial on recent priority scores for an entity.
    Returns:
        slope: rate of increase or decrease in priority per run
        next_value_estimate: extrapolated next score
        confidence: 'high' | 'moderate' | 'insufficient_data'
        history: list of float scores
        projected: next predicted step
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT score, computed_at
            FROM priority_scores
            WHERE entity_id = ?
            ORDER BY computed_at ASC;
        """, (str(entity_id),))
        rows = cursor.fetchall()

    if not rows:
        return {
            "slope": 0.0,
            "next_value_estimate": 50.0,
            "confidence": "insufficient_data",
            "history": [50.0],
            "projected": 50.0
        }

    scores = [float(r[0]) for r in rows][-window:]
    n = len(scores)

    if n < 3:
        last_val = scores[-1]
        return {
            "slope": 0.0,
            "next_value_estimate": last_val,
            "confidence": "insufficient_data",
            "history": scores,
            "projected": last_val
        }

    x = np.arange(n)
    y = np.array(scores)

    # Fit degree 1 polynomial (linear regression)
    poly = np.polyfit(x, y, deg=1)
    slope = float(poly[0])
    intercept = float(poly[1])

    # Next value at step n
    next_val = float(slope * n + intercept)
    next_val_clamped = round(max(0.0, min(100.0, next_val)), 1)

    confidence = "high" if n >= 5 else "moderate"

    return {
        "slope": round(slope, 2),
        "next_value_estimate": next_val_clamped,
        "confidence": confidence,
        "history": scores,
        "projected": next_val_clamped
    }
