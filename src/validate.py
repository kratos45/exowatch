from pathlib import Path
from datetime import datetime, timezone
import csv
import json

CURRENT_YEAR = datetime.now(timezone.utc).year

def load_latest_raw_exoplanets():
    raw_files = sorted(Path("data/raw").glob("source_*.csv"))
    if not raw_files: return []
    with open(raw_files[-1], newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def load_latest_raw_neos():
    raw_files = sorted(Path("data/raw").glob("neo_source_*.json"))
    if not raw_files: return []
    with open(raw_files[-1], "r", encoding="utf-8") as f:
        return json.load(f)

def is_valid_exoplanet(row):
    reasons = []
    if not row.get("pl_name", "").strip():
        reasons.append("entity_id_vide")
    try:
        year = int(row.get("disc_year", 0))
        if not (1995 <= year <= CURRENT_YEAR):
            reasons.append("disc_year_hors_plage")
    except ValueError:
        reasons.append("disc_year_invalide")
    
    pl_rade = row.get("pl_rade", "").strip()
    if pl_rade:
        try:
            if float(pl_rade) <= 0:
                reasons.append("pl_rade_non_positif")
        except ValueError:
            reasons.append("pl_rade_invalide")
            
    pl_orbper = row.get("pl_orbper", "").strip()
    if pl_orbper:
        try:
            if float(pl_orbper) <= 0:
                reasons.append("pl_orbper_non_positif")
        except ValueError:
            reasons.append("pl_orbper_invalide")
    return reasons

def is_valid_neo(row):
    reasons = []
    if not row.get("id"):
        reasons.append("neo_id_vide")
    if not row.get("name"):
        reasons.append("neo_name_vide")
    orb_data = row.get("orbital_data", {})
    if not orb_data.get("semi_major_axis"):
        reasons.append("semi_major_axis_manquant")
    if not orb_data.get("eccentricity"):
        reasons.append("eccentricity_manquant")
    if not orb_data.get("orbital_period"):
        reasons.append("orbital_period_manquant")
    return reasons

def validate_exoplanets(rows):
    accepted, rejected = [], []
    for row in rows:
        reasons = is_valid_exoplanet(row)
        if reasons:
            row["rejection_reason"] = ";".join(reasons)
            rejected.append(row)
        else:
            accepted.append(row)
    return accepted, rejected

def validate_neos(rows):
    accepted, rejected = [], []
    for row in rows:
        reasons = is_valid_neo(row)
        if reasons:
            row["rejection_reason"] = ";".join(reasons)
            rejected.append(row)
        else:
            accepted.append(row)
    return accepted, rejected

if __name__ == "__main__":
    exo_rows = load_latest_raw_exoplanets()
    exo_acc, exo_rej = validate_exoplanets(exo_rows)
    print(f"Exoplanètes -> Total : {len(exo_rows)} | Acceptées : {len(exo_acc)} | Rejetées : {len(exo_rej)}")
    
    neo_rows = load_latest_raw_neos()
    if neo_rows:
        neo_acc, neo_rej = validate_neos(neo_rows)
        print(f"NEOs -> Total : {len(neo_rows)} | Acceptées : {len(neo_acc)} | Rejetées : {len(neo_rej)}")