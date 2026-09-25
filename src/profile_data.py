"""
Data profiling module for ExoWatch.
Generates structural and statistical profiling reports from raw NeoWS payloads.
"""

import sys
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def parse_raw_neows_to_df(raw_json_path: Path) -> pd.DataFrame:
    """Parses raw NeoWS JSON payload into a flat pandas DataFrame for profiling."""
    with open(raw_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = []
    neo_by_date = data.get("near_earth_objects", {})
    for date_str, neo_list in neo_by_date.items():
        for neo in neo_list:
            cad = neo.get("close_approach_data", [{}])
            first_cad = cad[0] if cad else {}

            row = {
                "entity_id": neo.get("id"),
                "name": neo.get("name"),
                "observed_at": first_cad.get("close_approach_date", date_str),
                "diameter_km_min": neo.get("estimated_diameter", {}).get("kilometers", {}).get("estimated_diameter_min"),
                "diameter_km_max": neo.get("estimated_diameter", {}).get("kilometers", {}).get("estimated_diameter_max"),
                "velocity_kmh": first_cad.get("relative_velocity", {}).get("kilometers_per_hour"),
                "miss_distance_km": first_cad.get("miss_distance", {}).get("kilometers"),
                "is_hazardous": neo.get("is_potentially_hazardous_asteroid"),
                "absolute_magnitude": neo.get("absolute_magnitude_h"),
                "orbiting_body": first_cad.get("orbiting_body")
            }
            records.append(row)

    df = pd.DataFrame(records)
    if not df.empty:
        df["velocity_kmh"] = pd.to_numeric(df["velocity_kmh"], errors="coerce")
        df["miss_distance_km"] = pd.to_numeric(df["miss_distance_km"], errors="coerce")
        df["diameter_km_min"] = pd.to_numeric(df["diameter_km_min"], errors="coerce")
        df["diameter_km_max"] = pd.to_numeric(df["diameter_km_max"], errors="coerce")
        df["absolute_magnitude"] = pd.to_numeric(df["absolute_magnitude"], errors="coerce")
    return df


def generate_profile_report(raw_json_path: Path) -> Path:
    """Generates a text profile report and saves it to reports/profile_<timestamp>.txt."""
    logger.info(f"Profiling raw file: {raw_json_path}")
    df = parse_raw_neows_to_df(raw_json_path)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = REPORTS_DIR / f"profile_{timestamp}.txt"

    lines = []
    lines.append("=" * 60)
    lines.append(f"EXOWATCH DATA PROFILING REPORT")
    lines.append(f"Date: {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"Source file: {raw_json_path}")
    lines.append("=" * 60)
    lines.append("")

    total_rows = len(df)
    lines.append(f"1. GENERAL METRICS")
    lines.append(f"   Total extracted observations: {total_rows}")
    lines.append(f"   Columns: {list(df.columns)}")
    lines.append("")

    if total_rows == 0:
        lines.append("   [WARNING] No records found in payload.")
    else:
        # Business key duplicates
        dups = df.duplicated(subset=["entity_id", "observed_at"]).sum()
        lines.append(f"2. BUSINESS KEY & UNIQUENESS")
        lines.append(f"   Business key: (entity_id, observed_at)")
        lines.append(f"   Duplicate rows count: {dups} ({dups / total_rows * 100:.2f}%)")
        lines.append("")

        # Missing values
        lines.append(f"3. MISSING VALUES ANALYSIS")
        for col in df.columns:
            missing_count = df[col].isnull().sum()
            missing_pct = missing_count / total_rows * 100
            lines.append(f"   - {col:<22}: {missing_count} missing ({missing_pct:.1f}%)")
        lines.append("")

        # Distribution of numeric variables
        num_cols = ["diameter_km_min", "diameter_km_max", "velocity_kmh", "miss_distance_km", "absolute_magnitude"]
        lines.append(f"4. NUMERICAL DISTRIBUTIONS")
        for col in num_cols:
            if col in df.columns and df[col].notnull().any():
                s = df[col].dropna()
                lines.append(f"   * {col}:")
                lines.append(f"       min:    {s.min():.4f}")
                lines.append(f"       max:    {s.max():.4f}")
                lines.append(f"       median: {s.median():.4f}")
                lines.append(f"       mean:   {s.mean():.4f}")
                lines.append(f"       std:    {s.std():.4f}")
        lines.append("")

        # Class balance
        lines.append(f"5. HAZARDOUS CLASS BALANCE")
        haz_counts = df["is_hazardous"].value_counts(dropna=False).to_dict()
        for k, v in haz_counts.items():
            lines.append(f"   - is_hazardous = {k}: {v} ({v / total_rows * 100:.1f}%)")

    lines.append("")
    lines.append("=" * 60)
    lines.append("END OF PROFILE REPORT")
    lines.append("=" * 60)

    report_content = "\n".join(lines)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    logger.info(f"Profile report generated at {report_path}")
    return report_path


if __name__ == "__main__":
    if len(sys.argv) > 1:
        file_path = Path(sys.argv[1])
    else:
        raw_files = sorted(Path("data/raw").glob("neows_raw_*.json"))
        if not raw_files:
            logger.error("No raw files found in data/raw/. Please run collect.py first.")
            sys.exit(1)
        file_path = raw_files[-1]

    report = generate_profile_report(file_path)
    print(f"Report generated: {report}")