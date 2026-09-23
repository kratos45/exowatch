from datetime import datetime, timezone
from pathlib import Path
import requests

RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

TAP_URL = (
    "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query="
    "select+pl_name,hostname,discoverymethod,disc_year,"
    "pl_orbper,pl_rade,pl_bmasse,st_teff,sy_dist+from+pscomppars"
    "&format=csv"
)

def collect(url: str = TAP_URL) -> Path:
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = RAW_DIR / f"source_{stamp}.csv"
    output.write_bytes(response.content)
    print(f"Fichier écrit : {output}")
    return output

if __name__ == "__main__":
    collect()