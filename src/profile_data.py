from pathlib import Path
import csv
from collections import Counter

raw_files = sorted(Path("data/raw").glob("source_*.csv"))
latest = raw_files[-1]
print(f"Fichier analysé : {latest}\n")

with open(latest, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

columns = reader.fieldnames
n_rows = len(rows)
print(f"Dimensions : {n_rows} lignes, {len(columns)} colonnes")
print(f"Colonnes : {columns}\n")

print("Taux de valeurs manquantes par colonne :")
for col in columns:
    missing = sum(1 for r in rows if r[col] is None or r[col].strip() == "")
    print(f"  {col}: {missing / n_rows:.2%}")

names = [r["pl_name"] for r in rows]
duplicates = n_rows - len(set(names))
print(f"\nDoublons sur pl_name : {duplicates}")

def stats(col):
    values = []
    for r in rows:
        v = r[col].strip()
        if v:
            try:
                values.append(float(v))
            except ValueError:
                pass
    if not values:
        return None
    return min(values), max(values), sum(values) / len(values)

print("\nStatistiques (min, max, moyenne) :")
for col in ["pl_orbper", "pl_rade", "pl_bmasse", "st_teff", "sy_dist"]:
    result = stats(col)
    print(f"  {col}: {result}")