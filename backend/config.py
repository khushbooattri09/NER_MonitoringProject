from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DEMO_DIR = DATA_DIR / "demo"
HISTORICAL_DIR = DATA_DIR / "historical"
UPLOADS_DIR = DATA_DIR / "uploads"
ARTIFACTS_DIR = DATA_DIR / "models"

for directory in (DATA_DIR, DEMO_DIR, HISTORICAL_DIR, UPLOADS_DIR, ARTIFACTS_DIR):
    directory.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'landslide_ner.db'}"

SUSCEPTIBILITY_CLASSES = ["Low", "Medium", "High"]
NER_STATES = [
    "Arunachal Pradesh",
    "Assam",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Sikkim",
    "Tripura",
]
