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
import db_neo4j

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

def save_exoplanets_neo4j(session, rows):
    for row in rows:
        session.run("""
            MERGE (s:Star {name: $hostname})
            ON CREATE SET s.st_teff = $st_teff, s.sy_dist = $sy_dist
            
            MERGE (e:Exoplanet {id: $pl_name})
            ON CREATE SET 
                e.name = $pl_name,
                e.discoverymethod = $discoverymethod,
                e.disc_year = $disc_year,
                e.pl_orbper = $pl_orbper,
                e.pl_rade = $pl_rade,
                e.pl_bmasse = $pl_bmasse,
                e.anomaly_score_heuristic = $anomaly_score_heuristic,
                e.anomaly_score_ml = $anomaly_score_ml
            
            MERGE (e)-[:ORBITS]->(s)
        """, {
            "pl_name": row.get("pl_name"),
            "hostname": row.get("hostname") or "Unknown Star",
            "discoverymethod": row.get("discoverymethod"),
            "disc_year": row.get("disc_year"),
            "pl_orbper": float(row.get("pl_orbper")) if row.get("pl_orbper") else None,
            "pl_rade": float(row.get("pl_rade")) if row.get("pl_rade") else None,
            "pl_bmasse": float(row.get("pl_bmasse")) if row.get("pl_bmasse") else None,
            "st_teff": float(row.get("st_teff")) if row.get("st_teff") else None,
            "sy_dist": float(row.get("sy_dist")) if row.get("sy_dist") else None,
            "anomaly_score_heuristic": row.get("anomaly_score_heuristic", 0),
            "anomaly_score_ml": row.get("anomaly_score_ml", 0)
        })

def save_neos_neo4j(session, rows, observed_at):
    for row in rows:
        orb_data = row.get("orbital_data", {})
        est_diam = row.get("estimated_diameter", {}).get("meters", {})
        d_min = est_diam.get("estimated_diameter_min")
        d_max = est_diam.get("estimated_diameter_max")
        
        ca_data = row.get("close_approach_data", [])
        ca_date, rel_vel, miss_dist = None, None, None
        if ca_data:
            ca = ca_data[0]
            ca_date = ca.get("close_approach_date")
            rel_vel = ca.get("relative_velocity", {}).get("kilometers_per_hour")
            miss_dist = ca.get("miss_distance", {}).get("lunar")
            
        session.run("""
            MERGE (n:NEO {id: $id})
            ON CREATE SET 
                n.name = $name,
                n.semi_major_axis = $semi_major_axis,
                n.eccentricity = $eccentricity,
                n.orbital_period = $orbital_period,
                n.perihelion_distance = $perihelion_distance,
                n.aphelion_distance = $aphelion_distance,
                n.is_potentially_hazardous_asteroid = $pha,
                n.absolute_magnitude_h = $h,
                n.estimated_diameter_min = $d_min,
                n.estimated_diameter_max = $d_max,
                n.close_approach_date = $ca_date,
                n.relative_velocity_kmh = $rel_vel,
                n.miss_distance_lunar = $miss_dist
                
            WITH n
            MATCH (sun:Star {name: 'Sun'})
            MERGE (n)-[:ORBITS]->(sun)
        """, {
            "id": row.get("id"),
            "name": row.get("name"),
            "semi_major_axis": float(orb_data.get("semi_major_axis") or 0),
            "eccentricity": float(orb_data.get("eccentricity") or 0),
            "orbital_period": float(orb_data.get("orbital_period") or 0),
            "perihelion_distance": float(orb_data.get("perihelion_distance") or 0),
            "aphelion_distance": float(orb_data.get("aphelion_distance") or 0),
            "pha": 1 if row.get("is_potentially_hazardous_asteroid") else 0,
            "h": float(row.get("absolute_magnitude_h") or 0),
            "d_min": float(d_min) if d_min else None,
            "d_max": float(d_max) if d_max else None,
            "ca_date": ca_date,
            "rel_vel": float(rel_vel) if rel_vel else None,
            "miss_dist": float(miss_dist) if miss_dist else None
        })
        
def load_and_save_sentry_neo4j(session):
    sentry_files = sorted(Path("data/raw").glob("sentry_source_*.json"))
    if not sentry_files: return 0
    with open(sentry_files[-1], "r", encoding="utf-8") as f:
        data = json.load(f)
    
    objects = data.get("data", [])
    count = 0
    for obj in objects:
        des = obj.get("des")
        if not des: continue
        # Link existing NEO to Earth
        res = session.run("""
            MATCH (n:NEO)
            WHERE n.name CONTAINS $des
            MATCH (e:Planet {name: 'Earth'})
            MERGE (n)-[r:THREATENS]->(e)
            SET r.probability = $ip,
                r.impact_range = $impact_range,
                r.diameter = $diameter
            RETURN n
        """, {
            "des": f"({des})",
            "ip": float(obj.get("ip") or 0),
            "impact_range": obj.get("range"),
            "diameter": obj.get("diameter")
        }).data()
        
        # If NEO wasn't in our NeoWs dataset but is in Sentry, we just create a minimal node
        if not res:
            session.run("""
                MERGE (n:NEO {id: $des})
                ON CREATE SET n.name = $des_name, n.is_potentially_hazardous_asteroid = 1
                WITH n
                MATCH (e:Planet {name: 'Earth'})
                MERGE (n)-[r:THREATENS]->(e)
                SET r.probability = $ip,
                    r.impact_range = $impact_range,
                    r.diameter = $diameter
            """, {
                "des": f"sentry_{des}",
                "des_name": f"Sentry: {des}",
                "ip": float(obj.get("ip") or 0),
                "impact_range": obj.get("range"),
                "diameter": obj.get("diameter")
            })
            
        count += 1
    return count

if __name__ == "__main__":
    start = time.perf_counter()
    db_neo4j.init_db()
    
    driver = db_neo4j.get_driver()
    
    report = {
        "pipeline": "exowatch_neo4j",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "exoplanets": {"input": 0, "accepted": 0, "rejected": 0},
        "neos": {"input": 0, "accepted": 0, "rejected": 0},
        "sentry": {"inserted": 0}
    }

    with driver.session() as session:
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
                save_exoplanets_neo4j(session, exo_acc)
                
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
                save_neos_neo4j(session, neo_acc, neo_observed_at)
                
            flat_neo_rej = [{"id": r.get("id"), "name": r.get("name"), "rejection_reason": r.get("rejection_reason")} for r in neo_rej]
            write_rejected(flat_neo_rej, REJECTED_DIR / "rejected_neos.csv")
            report["neos"]["accepted"] = len(neo_acc)
            report["neos"]["rejected"] = len(neo_rej)
            
        # --- SENTRY ---
        sentry_count = load_and_save_sentry_neo4j(session)
        report["sentry"]["inserted"] = sentry_count

    driver.close()

    duration = round(time.perf_counter() - start, 2)
    report["duration_seconds"] = duration
    
    Path("reports").mkdir(exist_ok=True)
    report_path = Path("reports") / f"run_report_neo4j_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Rapport Neo4j écrit : {report_path}")
    print(f"Exoplanètes : {report['exoplanets']['accepted']} insérées, {report['exoplanets']['rejected']} rejetées.")
    print(f"NEOs : {report['neos']['accepted']} insérés, {report['neos']['rejected']} rejetés.")
    print(f"Sentry : {report['sentry']['inserted']} menaces évaluées.")