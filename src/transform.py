from pathlib import Path
from datetime import datetime, timezone
import csv
import statistics
import re
import math
from validate import load_latest_raw, validate

CURATED_DIR = Path("data/curated")
REJECTED_DIR = Path("data/rejected")
CURATED_DIR.mkdir(parents=True, exist_ok=True)
REJECTED_DIR.mkdir(parents=True, exist_ok=True)

CURATED_FILE = CURATED_DIR / "dataset.csv"
REJECTED_FILE = REJECTED_DIR / "rejected_rows.csv"
NUMERIC_FIELDS = ["pl_rade", "pl_bmasse", "pl_orbper"]

def get_latest_raw_path():
    return sorted(Path("data/raw").glob("source_*.csv"))[-1]

def extract_observed_at(raw_path):
    stamp = re.search(r"source_(\d{8}T\d{6}Z)", raw_path.name).group(1)
    return datetime.strptime(stamp, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).isoformat()



def compute_anomaly_scores(rows):
    log_values = {f: [] for f in NUMERIC_FIELDS}
    for row in rows:
        for f in NUMERIC_FIELDS:
            v = row[f].strip()
            if v:
                try:
                    val = float(v)
                    if val > 0:
                        log_values[f].append(math.log10(val))
                except ValueError:
                    pass

    medians, mads = {}, {}
    for f in NUMERIC_FIELDS:
        vals = log_values[f]
        med = statistics.median(vals)
        mad = statistics.median([abs(v - med) for v in vals]) or 1e-9
        medians[f], mads[f] = med, mad

    raw_z = []
    for row in rows:
        z_scores = []
        for f in NUMERIC_FIELDS:
            v = row[f].strip()
            if v:
                try:
                    val = float(v)
                    if val > 0:
                        z = abs(math.log10(val) - medians[f]) / (1.4826 * mads[f])
                        z_scores.append(z)
                except ValueError:
                    pass
        max_z = max(z_scores) if z_scores else 0.0
        row["_max_z"] = max_z
        raw_z.append(max_z)

    global_max = max(raw_z) or 1e-9
    for row in rows:
        row["anomaly_score"] = round(row.pop("_max_z") / global_max, 4)
    return rows
    values_by_field = {f: [] for f in NUMERIC_FIELDS}
    for row in rows:
        for f in NUMERIC_FIELDS:
            v = row[f].strip()
            if v:
                try:
                    values_by_field[f].append(float(v))
                except ValueError:
                    pass

    medians, mads = {}, {}
    for f in NUMERIC_FIELDS:
        vals = values_by_field[f]
        med = statistics.median(vals)
        mad = statistics.median([abs(v - med) for v in vals]) or 1e-9
        medians[f], mads[f] = med, mad

    for row in rows:
        z_scores = []
        for f in NUMERIC_FIELDS:
            v = row[f].strip()
            if v:
                try:
                    z = abs(float(v) - medians[f]) / (1.4826 * mads[f])
                    z_scores.append(z)
                except ValueError:
                    pass
        max_z = max(z_scores) if z_scores else 0.0
        row["anomaly_score"] = round(min(1.0, max_z / 10), 4)
    return rows

def merge_with_existing(new_rows):
    existing = {}
    if CURATED_FILE.exists():
        with open(CURATED_FILE, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                existing[row["entity_id"]] = row
    for row in new_rows:
        record = {
            "observed_at": row["observed_at"], "entity_id": row["pl_name"],
            "hostname": row["hostname"], "discoverymethod": row["discoverymethod"],
            "disc_year": row["disc_year"], "pl_orbper": row["pl_orbper"],
            "pl_rade": row["pl_rade"], "pl_bmasse": row["pl_bmasse"],
            "st_teff": row["st_teff"], "sy_dist": row["sy_dist"],
            "anomaly_score": row["anomaly_score"],
        }
        existing[record["entity_id"]] = record  # upsert par cle metier
    return list(existing.values())

def write_curated(rows):
    fieldnames = ["observed_at", "entity_id", "hostname", "discoverymethod", "disc_year",
                  "pl_orbper", "pl_rade", "pl_bmasse", "st_teff", "sy_dist", "anomaly_score"]
    with open(CURATED_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

def write_rejected(rows):
    if not rows:
        return
    with open(REJECTED_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

import json
import time

if __name__ == "__main__":
    start = time.perf_counter()

    raw_path = get_latest_raw_path()
    observed_at = extract_observed_at(raw_path)
    rows = load_latest_raw()
    accepted, rejected = validate(rows)
    for row in accepted:
        row["observed_at"] = observed_at

    accepted = compute_anomaly_scores(accepted)
    merged = merge_with_existing(accepted)

    write_curated(merged)
    write_rejected(rejected)

    duration = round(time.perf_counter() - start, 2)
    report = {
        "pipeline": "exowatch",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "source_file": raw_path.name,
        "input_rows": len(rows),
        "accepted_rows": len(accepted),
        "rejected_rows": len(rejected),
        "curated_total_rows": len(merged),
        "atypical_candidates": sum(1 for r in merged if float(r["anomaly_score"]) > 0.5),
        "quality_status": "PASS_WITH_WARNINGS" if rejected else "PASS",
        "duration_seconds": duration,
    }
    Path("reports").mkdir(exist_ok=True)
    report_path = Path("reports") / f"run_report_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Curated (cumulé) : {len(merged)} lignes | Nouveau lot : {len(accepted)} | Rejetées : {len(rejected)}")
    print(f"Rapport écrit : {report_path}")
    top5 = sorted(merged, key=lambda r: float(r["anomaly_score"]), reverse=True)[:5]
    print("\nTop 5 candidats atypiques :")
    for r in top5:
        print(f"  {r['entity_id']} (score={r['anomaly_score']}, rayon={r['pl_rade']}, masse={r['pl_bmasse']}, période={r['pl_orbper']})")