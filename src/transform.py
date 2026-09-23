from pathlib import Path
from datetime import datetime, timezone
import csv
import statistics
import re
import math
import json
import time

import numpy as np

from validate import (
    load_latest_raw_exoplanets, load_latest_raw_neos,
    validate_exoplanets, validate_neos
)
import db

CURATED_DIR = Path("data/curated")
REJECTED_DIR = Path("data/rejected")
CURATED_DIR.mkdir(parents=True, exist_ok=True)
REJECTED_DIR.mkdir(parents=True, exist_ok=True)

NUMERIC_FIELDS = ["pl_rade", "pl_bmasse", "pl_orbper"]

def extract_observed_at(raw_path_name, pattern):
    match = re.search(pattern, raw_path_name)
    if not match: return datetime.now(timezone.utc).isoformat()
    stamp = match.group(1)
    return datetime.strptime(stamp, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).isoformat()


def compute_anomaly_scores(rows):
    log_values = {f: [] for f in NUMERIC_FIELDS}
    for row in rows:
        for f in NUMERIC_FIELDS:
            v = str(row.get(f, "")).strip()
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
        if not vals:
            medians[f], mads[f] = 0, 1e-9
            continue
        med = statistics.median(vals)
        mad = statistics.median([abs(v - med) for v in vals]) or 1e-9
        medians[f], mads[f] = med, mad

    raw_z = []
    for row in rows:
        z_scores = []
        for f in NUMERIC_FIELDS:
            v = str(row.get(f, "")).strip()
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

    global_max = max(raw_z) if raw_z and max(raw_z) > 0 else 1e-9
    for row in rows:
        row["anomaly_score_heuristic"] = round(row.pop("_max_z") / global_max, 4)
    return rows


def _c_factor(n):
    if n > 2:
        return 2.0 * (np.log(n - 1) + 0.5772156649) - 2.0 * (n - 1) / n
    if n == 2:
        return 1.0
    return 0.0

def _build_itree(X, depth, max_depth, rng):
    n = X.shape[0]
    if depth >= max_depth or n <= 1:
        return {"leaf": True, "size": n}
    feature = rng.integers(0, X.shape[1])
    col = X[:, feature]
    min_v, max_v = col.min(), col.max()
    if min_v == max_v:
        return {"leaf": True, "size": n}
    split_value = rng.uniform(min_v, max_v)
    left_mask = col < split_value
    return {
        "leaf": False, "feature": feature, "value": split_value,
        "left": _build_itree(X[left_mask], depth + 1, max_depth, rng),
        "right": _build_itree(X[~left_mask], depth + 1, max_depth, rng),
    }

def _path_length(x, node, depth):
    if node["leaf"]:
        return depth + _c_factor(node["size"])
    if x[node["feature"]] < node["value"]:
        return _path_length(x, node["left"], depth + 1)
    return _path_length(x, node["right"], depth + 1)

def compute_ml_anomaly_score(rows, n_trees=150, sample_size=256, random_state=42):
    col_log_values = {f: [] for f in NUMERIC_FIELDS}
    for row in rows:
        for f in NUMERIC_FIELDS:
            v = str(row.get(f, "")).strip()
            if v:
                try:
                    val = float(v)
                    if val > 0:
                        col_log_values[f].append(math.log10(val))
                except ValueError:
                    pass
    
    col_medians = {}
    for f in NUMERIC_FIELDS:
        if col_log_values[f]:
            col_medians[f] = statistics.median(col_log_values[f])
        else:
            col_medians[f] = 0.0

    X = []
    for row in rows:
        feat = []
        for f in NUMERIC_FIELDS:
            v = str(row.get(f, "")).strip()
            val = None
            if v:
                try:
                    parsed = float(v)
                    if parsed > 0:
                        val = math.log10(parsed)
                except ValueError:
                    pass
            feat.append(val if val is not None else col_medians[f])
        X.append(feat)
    X = np.array(X)
    
    if len(X) == 0:
        for row in rows:
            row["anomaly_score_ml"] = 0.0
        return rows

    rng = np.random.default_rng(random_state)
    n = X.shape[0]
    psi = min(sample_size, n)
    max_depth = int(np.ceil(np.log2(max(psi, 2))))

    trees = []
    for _ in range(n_trees):
        idx = rng.choice(n, size=psi, replace=False)
        trees.append(_build_itree(X[idx], 0, max_depth, rng))

    c_psi = _c_factor(psi)
    avg_paths = np.zeros(n)
    for tree in trees:
        for i in range(n):
            avg_paths[i] += _path_length(X[i], tree, 0)
    avg_paths /= n_trees

    scores = 2.0 ** (-avg_paths / (c_psi if c_psi > 0 else 1))
    s_min, s_max = scores.min(), scores.max()

    for row, s in zip(rows, scores):
        normalized = (s - s_min) / (s_max - s_min) if s_max > s_min else 0.0
        row["anomaly_score_ml"] = round(float(normalized), 4)
    return rows


def write_rejected(rows, filepath):
    if not rows:
        return
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def save_exoplanets_db(conn, rows):
    cursor = conn.cursor()
    for row in rows:
        cursor.execute("""
            INSERT OR REPLACE INTO exoplanets 
            (entity_id, observed_at, hostname, discoverymethod, disc_year, pl_orbper, pl_rade, pl_bmasse, st_teff, sy_dist, anomaly_score_heuristic, anomaly_score_ml)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row.get("pl_name"), row.get("observed_at"), row.get("hostname"), row.get("discoverymethod"), row.get("disc_year"),
            row.get("pl_orbper") if row.get("pl_orbper") else None,
            row.get("pl_rade") if row.get("pl_rade") else None,
            row.get("pl_bmasse") if row.get("pl_bmasse") else None,
            row.get("st_teff") if row.get("st_teff") else None,
            row.get("sy_dist") if row.get("sy_dist") else None,
            row.get("anomaly_score_heuristic", 0), row.get("anomaly_score_ml", 0)
        ))
    conn.commit()


def save_neos_db(conn, rows, observed_at):
    cursor = conn.cursor()
    for row in rows:
        orb_data = row.get("orbital_data", {})
        cursor.execute("""
            INSERT OR REPLACE INTO neo_objects
            (entity_id, observed_at, name, semi_major_axis, eccentricity, orbital_period, perihelion_distance, aphelion_distance, is_potentially_hazardous_asteroid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row.get("id"), observed_at, row.get("name"),
            orb_data.get("semi_major_axis"),
            orb_data.get("eccentricity"),
            orb_data.get("orbital_period"),
            orb_data.get("perihelion_distance"),
            orb_data.get("aphelion_distance"),
            1 if row.get("is_potentially_hazardous_asteroid") else 0
        ))
    conn.commit()


if __name__ == "__main__":
    start = time.perf_counter()
    conn = db.get_connection()
    db.init_db() # Ensure tables exist
    
    report = {
        "pipeline": "exowatch",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "exoplanets": {"input": 0, "accepted": 0, "rejected": 0},
        "neos": {"input": 0, "accepted": 0, "rejected": 0},
    }

    # --- EXOPLANETS ---
    raw_exo_files = sorted(Path("data/raw").glob("source_*.csv"))
    if raw_exo_files:
        exo_observed_at = extract_observed_at(raw_exo_files[-1].name, r"source_(\d{8}T\d{6}Z)")
        exo_rows = load_latest_raw_exoplanets()
        report["exoplanets"]["input"] = len(exo_rows)
        exo_acc, exo_rej = validate_exoplanets(exo_rows)
        for row in exo_acc:
            row["observed_at"] = exo_observed_at
            
        if exo_acc:
            exo_acc = compute_anomaly_scores(exo_acc)
            exo_acc = compute_ml_anomaly_score(exo_acc)
            save_exoplanets_db(conn, exo_acc)
            
        write_rejected(exo_rej, REJECTED_DIR / "rejected_exoplanets.csv")
        report["exoplanets"]["accepted"] = len(exo_acc)
        report["exoplanets"]["rejected"] = len(exo_rej)

    # --- NEOS ---
    raw_neo_files = sorted(Path("data/raw").glob("neo_source_*.json"))
    if raw_neo_files:
        neo_observed_at = extract_observed_at(raw_neo_files[-1].name, r"neo_source_(\d{8}T\d{6}Z)")
        neo_rows = load_latest_raw_neos()
        report["neos"]["input"] = len(neo_rows)
        neo_acc, neo_rej = validate_neos(neo_rows)
        
        if neo_acc:
            save_neos_db(conn, neo_acc, neo_observed_at)
            
        flat_neo_rej = [{"id": r.get("id"), "name": r.get("name"), "rejection_reason": r.get("rejection_reason")} for r in neo_rej]
        write_rejected(flat_neo_rej, REJECTED_DIR / "rejected_neos.csv")
        report["neos"]["accepted"] = len(neo_acc)
        report["neos"]["rejected"] = len(neo_rej)

    conn.close()

    duration = round(time.perf_counter() - start, 2)
    report["duration_seconds"] = duration
    
    Path("reports").mkdir(exist_ok=True)
    report_path = Path("reports") / f"run_report_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Rapport écrit : {report_path}")
    print(f"Exoplanètes : {report['exoplanets']['accepted']} insérées, {report['exoplanets']['rejected']} rejetées.")
    print(f"NEOs : {report['neos']['accepted']} insérés, {report['neos']['rejected']} rejetés.")