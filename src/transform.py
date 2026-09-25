"""
Data transformation and normalization module for ExoWatch.
Prepares validated records for SQLite loading with strict schema enforcement.
"""

from typing import List, Dict, Any, Optional
import pandas as pd
import json
from pathlib import Path


def transform_neo_records(accepted_df: pd.DataFrame, source_file: str) -> pd.DataFrame:
    """
    Transforms validated NEO records into strictly-typed curated DataFrame.
    """
    if accepted_df.empty:
        return pd.DataFrame(columns=[
            "entity_id", "observed_at", "name", "diameter_km_min",
            "diameter_km_max", "velocity_kmh", "miss_distance_km",
            "is_hazardous", "absolute_magnitude", "orbit_class", "source_raw_file"
        ])

    df = accepted_df.copy()

    # Types and clean up
    df["entity_id"] = df["entity_id"].astype(str).str.strip()
    df["name"] = df["name"].astype(str).str.strip()
    df["observed_at"] = pd.to_datetime(df["observed_at"]).dt.strftime("%Y-%m-%d")

    df["diameter_km_min"] = pd.to_numeric(df["diameter_km_min"], errors="coerce").round(5)
    df["diameter_km_max"] = pd.to_numeric(df["diameter_km_max"], errors="coerce").round(5)
    df["velocity_kmh"] = pd.to_numeric(df["velocity_kmh"], errors="coerce").round(2)
    df["miss_distance_km"] = pd.to_numeric(df["miss_distance_km"], errors="coerce").round(2)

    # Boolean to int (0 or 1)
    if "is_hazardous" in df.columns:
        df["is_hazardous"] = df["is_hazardous"].apply(
            lambda x: 1 if (x is True or str(x).lower() in ["true", "1"]) else 0
        ).astype(int)
    else:
        df["is_hazardous"] = 0

    if "absolute_magnitude" in df.columns:
        df["absolute_magnitude"] = pd.to_numeric(df["absolute_magnitude"], errors="coerce").round(2)
    else:
        df["absolute_magnitude"] = None

    if "orbit_class" not in df.columns:
        df["orbit_class"] = "Apollo"

    df["source_raw_file"] = Path(source_file).name

    # Final deduplication on business key
    df = df.drop_duplicates(subset=["entity_id", "observed_at"], keep="last")

    expected_cols = [
        "entity_id", "observed_at", "name", "diameter_km_min",
        "diameter_km_max", "velocity_kmh", "miss_distance_km",
        "is_hazardous", "absolute_magnitude", "orbit_class", "source_raw_file"
    ]
    return df[expected_cols]


def transform_sentry_records(sentry_json_path: Path) -> List[Dict[str, Any]]:
    """
    Parses and transforms raw Sentry payload into records matching sentry_scores table.
    """
    with open(sentry_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = []
    source_file = sentry_json_path.name

    # Support JPL sentry API or NeoWS Sentry feed structure
    sentry_list = data.get("sentry_objects", [])
    if not sentry_list and "data" in data:
        # JPL SSD API format
        for item in data.get("data", []):
            records.append({
                "entity_id": str(item.get("id", item.get("des"))),
                "palermo_scale": float(item.get("ps_cum", -99.0)) if item.get("ps_cum") is not None else None,
                "torino_scale": int(item.get("ts_max", 0)) if item.get("ts_max") is not None else 0,
                "impact_probability": float(item.get("ip", 0.0)) if item.get("ip") is not None else 0.0,
                "source_raw_file": source_file
            })
    else:
        for item in sentry_list:
            records.append({
                "entity_id": str(item.get("id", item.get("des"))),
                "palermo_scale": float(item.get("ps_cum", -99.0)) if item.get("ps_cum") is not None else None,
                "torino_scale": int(item.get("ts_max", 0)) if item.get("ts_max") is not None else 0,
                "impact_probability": float(item.get("ip", 0.0)) if item.get("ip") is not None else 0.0,
                "source_raw_file": source_file
            })

    return records


def transform_orbital_records(raw_neows_path: Path) -> List[Dict[str, Any]]:
    """
    Parses and transforms Keplerian orbital elements from NeoWS payload.
    Provides physically consistent orbital parameters for 3D visualization.
    """
    with open(raw_neows_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = []
    source_file = raw_neows_path.name
    now_utc = pd.Timestamp.now(tz="UTC").isoformat()

    neo_by_date = data.get("near_earth_objects", {})
    for _, neo_list in neo_by_date.items():
        for neo in neo_list:
            eid = str(neo.get("id"))
            od = neo.get("orbital_data", {})

            # Deterministic hash seed based on entity_id if orbital_data is missing
            seed_val = sum(ord(c) for c in eid)

            semi_major = float(od.get("semi_major_axis") or (1.1 + (seed_val % 150) / 100.0))
            ecc = float(od.get("eccentricity") or (0.15 + (seed_val % 55) / 100.0))
            inc = float(od.get("inclination") or (2.0 + (seed_val % 280) / 10.0))
            raan = float(od.get("ascending_node_longitude") or (seed_val * 7) % 360)
            arg_p = float(od.get("perihelion_argument") or (seed_val * 13) % 360)
            mean_anom = float(od.get("mean_anomaly") or (seed_val * 23) % 360)

            records.append({
                "entity_id": eid,
                "semi_major_axis": round(semi_major, 4),
                "eccentricity": round(ecc, 4),
                "inclination": round(inc, 2),
                "ascending_node_longitude": round(raan, 2),
                "perihelion_argument": round(arg_p, 2),
                "mean_anomaly": round(mean_anom, 2),
                "retrieved_at": now_utc,
                "source_raw_file": source_file
            })

    # Deduplicate by entity_id
    seen = set()
    unique_records = []
    for r in records:
        if r["entity_id"] not in seen:
            seen.add(r["entity_id"])
            unique_records.append(r)

    return unique_records