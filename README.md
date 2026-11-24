# AI-Based Landslide Risk Prediction and Monitoring Using Machine Learning for NER

**Smart India Hackathon (SIH) Problem Statement ID:** `SIH 26001`

A full-stack geospatial monitoring, live weather integration, and machine learning web application covering all eight North Eastern states of India (**Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Tripura, and Sikkim**).

---

## Project Architecture

```
├── backend/                          # Python FastAPI REST API + ML & Weather Engine
│   ├── main.py                       # FastAPI entrypoint, SQLite migration & bootstrapping
│   ├── config.py                     # Paths, SQLite URL, NER state constants
│   ├── database.py                   # SQLAlchemy engine & session management
│   ├── models.py                     # ORM tables: datasets, observations, model runs, prediction history
│   ├── schemas.py                    # Pydantic request/response schemas
│   ├── scripts/
│   │   └── build_historical_ner_dataset.py # Historical ERA5-Land + documented NER event builder
│   ├── routers/
│   │   ├── regions.py                # /api/regions/overview, /geojson, /environmental
│   │   ├── weather.py                # /api/weather/live, /states (Open-Meteo Live API)
│   │   ├── datasets.py               # /api/datasets, /upload, /activate, /reset-demo, /sample-csv
│   │   ├── models_ml.py              # /api/models/evaluations, /train
│   │   └── predictions.py            # /api/predictions/predict, /predict-live, /alerts, /history
│   ├── services/
│   │   ├── ner_reference.py          # All 8 NER states, bounding polygons & 32 district coordinates
│   │   ├── weather_service.py        # Open-Meteo live weather & soil moisture client + Demo Mode fallback
│   │   ├── geospatial.py             # GeoPandas spatial joins/CRS projection & Rasterio DEM slope
│   │   └── ml_pipeline.py            # Scikit-learn Random Forest/Decision Tree/LogReg + Joblib persistence
│   ├── tests/
│   │   └── test_api.py               # Automated pytest suite
│   └── requirements.txt
├── src/                              # React + TypeScript + Tailwind CSS Frontend
│   ├── components/
│   │   ├── TopBar.tsx                # Navigation bar
│   │   ├── LiveMonitorPanel.tsx      # Real-time Open-Meteo weather + live ML risk prediction
│   │   ├── AlertsPanel.tsx           # ML High-Risk alerts separated from rule-based advisories
│   │   ├── NerRiskMap.tsx            # Interactive 8-state Leaflet map
│   │   ├── EnvironmentalCharts.tsx   # Historical rainfall trends, event counts & terrain profiles
│   │   ├── ModelDashboard.tsx        # Training/Testing accuracy, Precision, Recall, F1, Confusion Matrix
│   │   ├── RiskSimulator.tsx         # Live/manual risk predictor & SQLite prediction history
│   │   └── DatasetManager.tsx        # CSV / GeoJSON / GeoTIFF upload & SQLite dataset registry
│   ├── services/api.ts               # Typed API client with offline cache fallback
│   └── types/landslide.ts            # Shared TypeScript interfaces
├── data/
│   ├── historical/                   # NER Historical Landslide + ERA5-Land dataset & metadata
│   ├── demo/                         # Synthetic GeoTIFF/GeoJSON/CSV demonstration benchmark
│   ├── models/                       # Joblib-saved trained Scikit-learn pipelines (.joblib)
│   └── landslide_ner.db              # SQLite database
└── server.ts                         # Express server on port 3000 (Vite + FastAPI proxy/supervisor)
```

---

## Data Sources, ML Pipeline & Transparency

1. **Historical Dataset (`data/historical/ner_historical_landslides.csv`)**:
   - Combines **30 documented NER historical landslide event windows (2022–2024)** across all 8 states with **Open-Meteo ERA5-Land Historical Reanalysis** daily precipitation (7-day antecedent + daily rainfall), temperature, relative humidity, and `0–7 cm` volumetric soil moisture, plus **Copernicus/Rasterio DEM** elevation and slope gradients.
   - Preserves realistic missing sensor cells (cleaned via median imputation during ingestion) and documents limitations transparently in the UI.
2. **Real Scikit-learn + Joblib ML Models**:
   - Trains **Random Forest Classifier**, **Decision Tree Classifier**, and **Logistic Regression** using `SimpleImputer(strategy="median")` + stratified train/test splitting.
   - Persists trained pipelines to `data/models/*.joblib` via **Joblib** (`joblib.dump` / `joblib.load`).
   - Computes real **Training Accuracy**, **Testing Accuracy**, **Precision**, **Recall**, **F1-Score**, and **Confusion Matrix** from actual model evaluation.
3. **Real-Time Weather Integration (Open-Meteo API)**:
   - Fetches live rainfall, 7-day cumulative rainfall, temperature, relative humidity, and satellite soil moisture without requiring an API key.
   - If soil moisture is unavailable in a feed, it is displayed explicitly as **`Unavailable`** (never invented).
   - If the external API is unreachable, the app enters a clearly labeled **Demo Mode Fallback** without mixing simulated data with genuine live readings.
4. **ML Predictions vs. Rule-Based Advisories**:
   - The **Alerts** and **Prediction** views explicitly separate **Scikit-learn ML Risk Predictions** (`LOW`, `MODERATE`, `HIGH`) from **Rule-Based Rainfall/Slope Threshold Advisories** (`WATCH`, `WARNING`).

---

## Step-by-Step Setup & Running Instructions

### 1. Python Backend Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 2. Optional: Rebuild Historical Dataset from Open-Meteo Archive

```bash
source .venv/bin/activate
python -m backend.scripts.build_historical_ner_dataset
```

### 3. Node.js Dependencies & Run Full-Stack App (Port 3000)

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. `server.ts` automatically starts the Python FastAPI backend on port `8001` and proxies `/api/*` requests.

---

## Verification & Tests

```bash
# Run backend ML, live weather, and API tests
.venv/bin/python -m pytest -v backend/tests/test_api.py

# TypeScript check & production frontend build
npm run lint
npm run build
```
