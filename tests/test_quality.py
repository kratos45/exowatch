"""
Unit tests for data quality rules and validation in ExoWatch.
"""

import pytest
import pandas as pd
from datetime import datetime, timedelta, timezone

from src.validate import (
    validate_r1_entity_id_not_null,
    validate_r2_observed_at,
    validate_r3_diameter,
    validate_r4_velocity,
    validate_r6_miss_distance,
    validate_dataset
)


def test_r1_entity_id_not_null():
    s = pd.Series(["2000433", None, "", "   ", "nan", "3542519"])
    valid = validate_r1_entity_id_not_null(s)
    assert valid.tolist() == [True, False, False, False, False, True]


def test_r2_observed_at_valid_date():
    today = datetime.now(timezone.utc).date()
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")
    tomorrow_str = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    s = pd.Series([yesterday_str, today_str, tomorrow_str, "2024/01/01", "invalid_date", None])
    valid = validate_r2_observed_at(s)
    # yesterday and today should be True, tomorrow and invalid should be False
    assert valid.iloc[0] is True or valid.iloc[0] == 1
    assert valid.iloc[1] is True or valid.iloc[1] == 1
    assert valid.iloc[2] is False or valid.iloc[2] == 0
    assert valid.iloc[3] is False or valid.iloc[3] == 0
    assert valid.iloc[4] is False or valid.iloc[4] == 0
    assert valid.iloc[5] is False or valid.iloc[5] == 0


def test_r3_diameter_positive_and_range():
    s = pd.Series([0.15, -0.05, 0.0, 1500.0, None, 12.4])
    valid = validate_r3_diameter(s)
    assert valid.tolist() == [True, False, False, False, False, True]


def test_r4_velocity_plausible_range():
    s = pd.Series([55000.0, 0.5, 250000.0, -100.0, 30000.0])
    valid = validate_r4_velocity(s)
    assert valid.tolist() == [True, False, False, False, True]


def test_r6_miss_distance_positive():
    s = pd.Series([1200000.0, 0.0, -500.0, None, 45000000.0])
    valid = validate_r6_miss_distance(s)
    assert valid.tolist() == [True, True, False, False, True]


def test_r5_and_validate_dataset_flow():
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    df = pd.DataFrame([
        # Valid row 1
        {
            "entity_id": "NEO-001",
            "observed_at": today_str,
            "diameter_km_min": 0.5,
            "diameter_km_max": 1.2,
            "velocity_kmh": 45000.0,
            "miss_distance_km": 1000000.0,
            "is_hazardous": 0,
            "name": "Asteroid A"
        },
        # Duplicate of row 1 (should be deduplicated under R5)
        {
            "entity_id": "NEO-001",
            "observed_at": today_str,
            "diameter_km_min": 0.5,
            "diameter_km_max": 1.2,
            "velocity_kmh": 45000.0,
            "miss_distance_km": 1000000.0,
            "is_hazardous": 0,
            "name": "Asteroid A - Dup"
        },
        # Invalid row: entity_id null (R1)
        {
            "entity_id": None,
            "observed_at": today_str,
            "diameter_km_min": 0.2,
            "diameter_km_max": 0.4,
            "velocity_kmh": 30000.0,
            "miss_distance_km": 5000000.0,
            "is_hazardous": 0,
            "name": "Asteroid Null ID"
        },
        # Invalid row: negative diameter (R3)
        {
            "entity_id": "NEO-002",
            "observed_at": today_str,
            "diameter_km_min": -0.1,
            "diameter_km_max": 0.3,
            "velocity_kmh": 40000.0,
            "miss_distance_km": 2000000.0,
            "is_hazardous": 1,
            "name": "Asteroid Neg Diam"
        },
        # Invalid row: negative miss distance (R6)
        {
            "entity_id": "NEO-003",
            "observed_at": today_str,
            "diameter_km_min": 0.3,
            "diameter_km_max": 0.6,
            "velocity_kmh": 50000.0,
            "miss_distance_km": -100.0,
            "is_hazardous": 0,
            "name": "Asteroid Neg Miss"
        }
    ])

    accepted, rejected, audit = validate_dataset(df)

    # 3 rejected rows (Null ID, Neg Diam, Neg Miss)
    assert len(rejected) == 3
    # 2 rows were candidate accepted, but 1 was a duplicate on (entity_id, observed_at) -> 1 final accepted
    assert len(accepted) == 1
    assert accepted.iloc[0]["entity_id"] == "NEO-001"

    # Verify audit metrics capture all 6 rules
    rule_ids = [m["rule_id"] for m in audit]
    assert "R1" in rule_ids
    assert "R2" in rule_ids
    assert "R3" in rule_ids
    assert "R4" in rule_ids
    assert "R5" in rule_ids
    assert "R6" in rule_ids
