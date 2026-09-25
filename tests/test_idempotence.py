"""
Idempotence tests for ExoWatch data pipeline.
Verifies that executing the pipeline multiple times on the same input dataset
guarantees zero duplicate rows in the curated store.
"""

import os
import json
import sqlite3
from pathlib import Path
import pytest
import pandas as pd

from src.db import init_db
from src.pipeline import load_curated_neo_observations, run_pipeline


@pytest.fixture
def sample_raw_json(tmp_path):
    """Generates a reproducible raw NeoWS sample payload."""
    payload = {
        "element_count": 2,
        "near_earth_objects": {
            "2026-03-20": [
                {
                    "id": "10001",
                    "name": "Asteroid Test Alpha",
                    "absolute_magnitude_h": 18.5,
                    "estimated_diameter": {
                        "kilometers": {
                            "estimated_diameter_min": 0.45,
                            "estimated_diameter_max": 0.95
                        }
                    },
                    "is_potentially_hazardous_asteroid": False,
                    "close_approach_data": [
                        {
                            "close_approach_date": "2026-03-20",
                            "relative_velocity": {
                                "kilometers_per_hour": "45200.0"
                            },
                            "miss_distance": {
                                "kilometers": "12500000.0"
                            },
                            "orbiting_body": "Earth"
                        }
                    ]
                },
                {
                    "id": "10002",
                    "name": "Asteroid Test Beta",
                    "absolute_magnitude_h": 22.1,
                    "estimated_diameter": {
                        "kilometers": {
                            "estimated_diameter_min": 0.08,
                            "estimated_diameter_max": 0.18
                        }
                    },
                    "is_potentially_hazardous_asteroid": True,
                    "close_approach_data": [
                        {
                            "close_approach_date": "2026-03-20",
                            "relative_velocity": {
                                "kilometers_per_hour": "62000.0"
                            },
                            "miss_distance": {
                                "kilometers": "3800000.0"
                            },
                            "orbiting_body": "Earth"
                        }
                    ]
                }
            ]
        }
    }
    file_path = tmp_path / "raw_sample.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    return file_path


@pytest.fixture
def sample_sentry_json(tmp_path):
    """Generates a reproducible raw Sentry sample payload."""
    payload = {
        "sentry_objects": [
            {
                "id": "10002",
                "des": "Asteroid Test Beta",
                "ps_cum": -3.5,
                "ts_max": 0,
                "ip": 0.00001
            }
        ]
    }
    file_path = tmp_path / "sentry_sample.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    return file_path


def test_upsert_idempotence_direct(tmp_path, monkeypatch):
    """Direct test of load_curated_neo_observations idempotence."""
    test_db = tmp_path / "test_curated.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{test_db}")

    init_db()

    df = pd.DataFrame([
        {
            "entity_id": "10001",
            "observed_at": "2026-03-20",
            "name": "Asteroid Alpha",
            "diameter_km_min": 0.45,
            "diameter_km_max": 0.95,
            "velocity_kmh": 45200.0,
            "miss_distance_km": 12500000.0,
            "is_hazardous": 0,
            "absolute_magnitude": 18.5,
            "orbit_class": "Apollo",
            "source_raw_file": "raw_sample.json"
        },
        {
            "entity_id": "10002",
            "observed_at": "2026-03-20",
            "name": "Asteroid Beta",
            "diameter_km_min": 0.08,
            "diameter_km_max": 0.18,
            "velocity_kmh": 62000.0,
            "miss_distance_km": 3800000.0,
            "is_hazardous": 1,
            "absolute_magnitude": 22.1,
            "orbit_class": "Apollo",
            "source_raw_file": "raw_sample.json"
        }
    ])

    # First load
    count1 = load_curated_neo_observations(df)
    assert count1 == 2

    conn = sqlite3.connect(test_db)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM neo_observations;")
    row_count_1 = cursor.fetchone()[0]
    assert row_count_1 == 2
    conn.close()

    # Second load with identical records
    count2 = load_curated_neo_observations(df)
    assert count2 == 2

    conn = sqlite3.connect(test_db)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM neo_observations;")
    row_count_2 = cursor.fetchone()[0]
    conn.close()

    # The row count in database MUST BE IDENTICAL (zero duplicates)
    assert row_count_1 == row_count_2 == 2


def test_pipeline_execution_idempotence(sample_raw_json, sample_sentry_json, tmp_path, monkeypatch):
    """End-to-end test running the full pipeline twice on the same raw file."""
    test_db = tmp_path / "test_pipeline.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{test_db}")

    # Run 1
    report1 = run_pipeline(raw_file=sample_raw_json, sentry_file=sample_sentry_json, enable_enrich=False)
    assert report1["accepted_rows"] == 2

    conn = sqlite3.connect(test_db)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM neo_observations;")
    count_run1 = c.fetchone()[0]
    conn.close()
    assert count_run1 == 2

    # Run 2 on the exact same raw file
    report2 = run_pipeline(raw_file=sample_raw_json, sentry_file=sample_sentry_json, enable_enrich=False)

    conn = sqlite3.connect(test_db)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM neo_observations;")
    count_run2 = c.fetchone()[0]
    conn.close()

    # Count must remain exactly 2, never 4
    assert count_run1 == count_run2 == 2
