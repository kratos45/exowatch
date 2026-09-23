from datetime import datetime, timezone
from pathlib import Path
import json
import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("NASA_API_KEY", "DEMO_KEY")

RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://api.nasa.gov/neo/rest/v1/neo/browse"
PAGES = 10  # ~200 objets, suffisant pour le TP

def fetch_page(page: int) -> dict:
    params = {"api_key": API_KEY, "page": page, "size": 20}
    response = requests.get(BASE_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json()

def collect_neo() -> Path:
    all_objects = []
    for page in range(PAGES):
        data = fetch_page(page)
        all_objects.extend(data.get("near_earth_objects", []))
        time.sleep(1)  # respecter le rate limit de l'API NASA

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = RAW_DIR / f"neo_source_{stamp}.json"
    output.write_text(json.dumps(all_objects, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Fichier écrit : {output} ({len(all_objects)} objets)")
    return output

if __name__ == "__main__":
    collect_neo()