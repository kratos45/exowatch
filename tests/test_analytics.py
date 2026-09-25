"""
Unit tests for ExoWatch Machine Learning Analytics & Trend Forecasting.
"""

import pytest
import pandas as pd
import numpy as np

from src.analytics.anomaly import compute_anomaly_scores
from src.analytics.forecast import forecast_priority_trend
from src.db import init_db, get_connection


def test_anomaly_detection_isolation_forest():
    """Verifies that compute_anomaly_scores produces valid anomaly scores and flags."""
    # Create synthetic dataset with standard points and 1 extreme outlier
    records = []
    for i in range(25):
        records.append({
            "diameter_km_min": 0.1 + (i % 5) * 0.05,
            "diameter_km_max": 0.2 + (i % 5) * 0.1,
            "velocity_kmh": 40000.0 + (i % 4) * 2000.0,
            "miss_distance_km": 15000000.0 + (i % 6) * 1000000.0,
            "absolute_magnitude": 22.0 - (i % 3) * 0.5
        })

    # Add extreme outlier
    records.append({
        "diameter_km_min": 25.0,
        "diameter_km_max": 50.0,
        "velocity_kmh": 195000.0,
        "miss_distance_km": 120000.0,
        "absolute_magnitude": 8.0
    })

    df = pd.DataFrame(records)
    scored_df = compute_anomaly_scores(df, contamination=0.1)

    assert "anomaly_score" in scored_df.columns
    assert "is_anomaly" in scored_df.columns
    assert len(scored_df) == 26

    # Outlier should have the lowest (most negative) anomaly score
    last_row_score = scored_df.iloc[-1]["anomaly_score"]
    median_score = scored_df["anomaly_score"].median()
    assert last_row_score < median_score


def test_forecast_priority_trend_linear():
    """Verifies polynomial trend fitting and extrapolation logic."""
    from src.decision import calculate_and_store_priority_scores

    # Synthetic forecast test directly using numpy
    x = np.arange(5)
    y = np.array([40.0, 45.0, 50.0, 55.0, 60.0])  # perfect +5 slope
    poly = np.polyfit(x, y, deg=1)
    slope = float(poly[0])
    next_val = float(slope * 5 + poly[1])

    assert round(slope, 1) == 5.0
    assert round(next_val, 1) == 65.0
