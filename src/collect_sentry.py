import json
import requests
from datetime import datetime, timezone
from pathlib import Path

def collect_sentry():
    url = "https://ssd-api.jpl.nasa.gov/sentry.api"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    data = response.json()
    
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    RAW_DIR = Path("data/raw")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RAW_DIR / f"sentry_source_{stamp}.json"
    out_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Sentry data saved to {out_path} ({len(data.get('data', []))} objects)")

if __name__ == "__main__":
    collect_sentry()
