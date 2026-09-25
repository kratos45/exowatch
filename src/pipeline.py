"""
Pipeline orchestrator module for ExoWatch.
Executes batch ETL flow:
collect -> profile -> validate -> transform -> load (UPSERT) -> enrich -> report
"""

import sys
import uuid
import time
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd

from src.db import init_db, get_connection
from src.collect import collect_neows, collect_sentry
from src.profile_data import generate_profile_report, parse_raw_neows_to_df
from src.validate import validate_dataset
from src.transform import transform_neo_records, transform_sentry_records
from src.enrich import enrich_asteroid, store_enrichments

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def load_curated_neo_observations(df: pd.DataFrame) -> int:
    """
    Loads transformed NEO records into neo_observations using SQLite UPSERT.
    Guarantees idempotence based on UNIQUE(entity_id, observed_at).
    """
    if df.empty:
        return 0

    records = df.to_dict(orient="records")
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO neo_observations (
                entity_id, observed_at, name, diameter_km_min, diameter_km_max,
                velocity_kmh, miss_distance_km, is_hazardous, absolute_magnitude,
                orbit_class, source_raw_file
            ) VALUES (
                :entity_id, :observed_at, :name, :diameter_km_min, :diameter_km_max,
                :velocity_kmh, :miss_distance_km, :is_hazardous, :absolute_magnitude,
                :orbit_class, :source_raw_file
            )
            ON CONFLICT(entity_id, observed_at) DO UPDATE SET
                name = excluded.name,
                diameter_km_min = excluded.diameter_km_min,
                diameter_km_max = excluded.diameter_km_max,
                velocity_kmh = excluded.velocity_kmh,
                miss_distance_km = excluded.miss_distance_km,
                is_hazardous = excluded.is_hazardous,
                absolute_magnitude = excluded.absolute_magnitude,
                orbit_class = excluded.orbit_class,
                source_raw_file = excluded.source_raw_file,
                loaded_at = datetime('now');
        """, records)
        conn.commit()
    return len(records)


def load_curated_sentry_scores(records: list) -> int:
    """Inserts Sentry scores into sentry_scores table."""
    if not records:
        return 0
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO sentry_scores (
                entity_id, palermo_scale, torino_scale, impact_probability, source_raw_file
            ) VALUES (
                :entity_id, :palermo_scale, :torino_scale, :impact_probability, :source_raw_file
            );
        """, records)
        conn.commit()
    return len(records)


def record_rejected_rows(rejected_df: pd.DataFrame, run_id: str):
    """Logs rejected observations into SQLite rejected_rows table."""
    if rejected_df.empty:
        return

    records = []
    for _, row in rejected_df.iterrows():
        entity_id = str(row.get("entity_id", "UNKNOWN"))
        reason = str(row.get("rejection_reason", "Validation failure"))
        payload = json.dumps(row.to_dict(), default=str)
        records.append({
            "entity_id": entity_id,
            "raw_payload": payload,
            "rejection_reason": reason,
            "run_id": run_id
        })

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO rejected_rows (entity_id, raw_payload, rejection_reason, run_id)
            VALUES (:entity_id, :raw_payload, :rejection_reason, :run_id);
        """, records)
        conn.commit()


def record_pipeline_run(run_metadata: dict):
    """Records pipeline run metrics in pipeline_runs table."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pipeline_runs (
                run_id, executed_at, source_file, input_rows, accepted_rows,
                rejected_rows, duplicates_removed, quality_status, duration_seconds
            ) VALUES (
                :run_id, :executed_at, :source_file, :input_rows, :accepted_rows,
                :rejected_rows, :duplicates_removed, :quality_status, :duration_seconds
            );
        """, run_metadata)
        conn.commit()


def run_pipeline(raw_file: Path = None, sentry_file: Path = None, enable_enrich: bool = True) -> dict:
    """
    Executes the complete pipeline run.
    Returns the run summary report dictionary.
    """
    start_time = time.time()
    run_id = str(uuid.uuid4())
    executed_at = datetime.now(timezone.utc).isoformat()
    logger.info(f"Starting ExoWatch pipeline run [{run_id}] at {executed_at}")

    # Ensure DB schema is in place
    init_db()

    # Step 1: Collect (if not provided)
    if not raw_file or not Path(raw_file).exists():
        raw_file = collect_neows()
    else:
        raw_file = Path(raw_file)

    if not sentry_file or not Path(sentry_file).exists():
        sentry_file = collect_sentry()
    else:
        sentry_file = Path(sentry_file)

    # Step 2: Profile
    profile_report_path = generate_profile_report(raw_file)
    logger.info(f"Step 2: Profile report saved at {profile_report_path}")

    # Step 3: Parse and Validate
    raw_df = parse_raw_neows_to_df(raw_file)
    input_rows = len(raw_df)

    accepted_df, rejected_df, audit_metrics = validate_dataset(raw_df)
    rejected_rows_count = len(rejected_df)
    duplicates_removed = 0
    for m in audit_metrics:
        if m["rule_id"] == "R5":
            duplicates_removed = m["failed"]

    # Record rejected rows
    record_rejected_rows(rejected_df, run_id)

    # Step 4: Transform
    transformed_df = transform_neo_records(accepted_df, str(raw_file))
    accepted_rows_count = len(transformed_df)

    # Step 5: Load Curated with UPSERT
    loaded_count = load_curated_neo_observations(transformed_df)
    logger.info(f"Step 5: Loaded {loaded_count} NEO records into curated database.")

    # Load Sentry
    sentry_records = transform_sentry_records(sentry_file)
    load_curated_sentry_scores(sentry_records)

    # Step 6: Decision Layer & Priority Scoring
    from src.decision import calculate_and_store_priority_scores
    scored_items = calculate_and_store_priority_scores(run_id)
    logger.info(f"Step 6: Computed priority scores for {len(scored_items)} asteroids.")

    # Step 7: AI Enrichment & Daily Briefing
    from src.enrich import generate_daily_brief
    enrichment_count = 0
    if enable_enrich and not transformed_df.empty:
        # Enrich up to 5 highest-priority NEOs per run to balance latency and cost
        priority_neos = transformed_df.sort_values(
            by=["is_hazardous", "miss_distance_km"], ascending=[False, True]
        ).head(5).to_dict(orient="records")

        all_enrichments = []
        for neo_item in priority_neos:
            enrichments = enrich_asteroid(neo_item, run_id)
            all_enrichments.extend(enrichments)

        store_enrichments(all_enrichments)
        enrichment_count = len(all_enrichments)
        logger.info(f"Step 7a: Created {enrichment_count} AI enrichment entries.")

        # Generate daily briefing executive summary
        brief_result = generate_daily_brief(run_id)
        logger.info(f"Step 7b: Daily briefing generated with model {brief_result.get('model_used')}.")

    # Step 8: Assess Quality Status
    if rejected_rows_count == 0 and duplicates_removed == 0:
        quality_status = "PASSED"
    elif accepted_rows_count > 0:
        quality_status = "PASSED_WITH_WARNINGS"
    else:
        quality_status = "FAILED"

    duration_seconds = round(time.time() - start_time, 2)

    # Step 8: Record Run Metadata
    run_metadata = {
        "run_id": run_id,
        "executed_at": executed_at,
        "source_file": raw_file.name,
        "input_rows": input_rows,
        "accepted_rows": accepted_rows_count,
        "rejected_rows": rejected_rows_count,
        "duplicates_removed": duplicates_removed,
        "quality_status": quality_status,
        "duration_seconds": duration_seconds
    }
    record_pipeline_run(run_metadata)

    # Step 9: Save JSON Execution Report
    report_data = {
        **run_metadata,
        "enrichments_created": enrichment_count,
        "audit_metrics": audit_metrics,
        "sample_rejections": rejected_df[["entity_id", "rejection_reason"]].head(10).to_dict(orient="records") if not rejected_df.empty else []
    }
    report_file = REPORTS_DIR / f"run_report_{run_id}.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    logger.info(f"Pipeline run [{run_id}] completed with status '{quality_status}' in {duration_seconds}s.")
    logger.info(f"Run report written to {report_file}")
    return report_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ExoWatch Batch Pipeline Orchestrator")
    parser.add_argument("--raw-file", type=str, help="Path to raw NeoWS JSON file", default=None)
    parser.add_argument("--sentry-file", type=str, help="Path to raw Sentry JSON file", default=None)
    parser.add_argument("--no-enrich", action="store_true", help="Disable AI enrichment step")
    args = parser.parse_args()

    report = run_pipeline(
        raw_file=Path(args.raw_file) if args.raw_file else None,
        sentry_file=Path(args.sentry_file) if args.sentry_file else None,
        enable_enrich=not args.no_enrich
    )
    print(json.dumps(report, indent=2))
