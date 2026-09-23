from pathlib import Path
from datetime import datetime, timezone
import csv

CURRENT_YEAR = datetime.now(timezone.utc).year

def load_latest_raw():
    raw_files = sorted(Path("data/raw").glob("source_*.csv"))
    with open(raw_files[-1], newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def is_valid(row):
    reasons = []
    if not row["pl_name"].strip():
        reasons.append("entity_id_vide")
    try:
        year = int(row["disc_year"])
        if not (1995 <= year <= CURRENT_YEAR):
            reasons.append("disc_year_hors_plage")
    except ValueError:
        reasons.append("disc_year_invalide")
    if row["pl_rade"].strip():
        try:
            if float(row["pl_rade"]) <= 0:
                reasons.append("pl_rade_non_positif")
        except ValueError:
            reasons.append("pl_rade_invalide")
    if row["pl_orbper"].strip():
        try:
            if float(row["pl_orbper"]) <= 0:
                reasons.append("pl_orbper_non_positif")
        except ValueError:
            reasons.append("pl_orbper_invalide")
    return reasons

def validate(rows):
    accepted, rejected = [], []
    for row in rows:
        reasons = is_valid(row)
        if reasons:
            row["rejection_reason"] = ";".join(reasons)
            rejected.append(row)
        else:
            accepted.append(row)
    return accepted, rejected

if __name__ == "__main__":
    rows = load_latest_raw()
    accepted, rejected = validate(rows)
    print(f"Total : {len(rows)} | Acceptées : {len(accepted)} | Rejetées : {len(rejected)}")