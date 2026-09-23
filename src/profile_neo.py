from pathlib import Path
import json

raw_files = sorted(Path("data/raw").glob("neo_source_*.json"))
latest = raw_files[-1]
objects = json.loads(latest.read_text(encoding="utf-8"))

print(f"Nombre d'objets : {len(objects)}\n")

sample = objects[0]
print("Champs de premier niveau :", list(sample.keys()))
print("\nChamps orbital_data :", list(sample.get("orbital_data", {}).keys()))
print("\nis_potentially_hazardous_asteroid :", sample.get("is_potentially_hazardous_asteroid"))
print("orbit_class :", sample.get("orbital_data", {}).get("orbit_class"))

missing_orbital = sum(1 for o in objects if "orbital_data" not in o or not o["orbital_data"])
print(f"\nObjets sans orbital_data : {missing_orbital} / {len(objects)}")

hazardous = sum(1 for o in objects if o.get("is_potentially_hazardous_asteroid"))
print(f"Objets classés dangereux : {hazardous} / {len(objects)}")