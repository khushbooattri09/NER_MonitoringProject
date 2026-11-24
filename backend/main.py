import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.config import HISTORICAL_DIR
from backend.database import Base, SessionLocal, engine
from backend.models import DatasetRecord, ModelEvaluationRun, ZoneObservation
from backend.routers import datasets, models_ml, predictions, regions, weather
from backend.services.geospatial import ensure_demonstration_assets, preprocess_csv_dataset
from backend.services.ml_pipeline import train_and_evaluate_models


def _migrate_sqlite_schema() -> None:
    """Safely add new columns to existing SQLite tables without destroying persisted data."""
    alter_statements = [
        ("zone_observations", "temperature_c", "FLOAT DEFAULT 22.0"),
        ("zone_observations", "humidity_pct", "FLOAT DEFAULT 78.0"),
        ("zone_observations", "observed_date", "VARCHAR(32)"),
        ("zone_observations", "event_source", "VARCHAR(250)"),
        ("model_evaluation_runs", "train_accuracy", "FLOAT"),
        ("prediction_history", "temperature_c", "FLOAT"),
        ("prediction_history", "humidity_pct", "FLOAT"),
        ("prediction_history", "weather_source", "VARCHAR(160)"),
        ("prediction_history", "influencing_factors_json", "TEXT"),
        ("prediction_history", "rule_advisory_json", "TEXT"),
    ]
    with engine.begin() as conn:
        for table, col, col_def in alter_statements:
            existing = {
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            }
            if existing and col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))


def bootstrap_database() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_schema()
    _, _, demo_csv = ensure_demonstration_assets()

    historical_csv = HISTORICAL_DIR / "ner_historical_landslides.csv"
    use_historical = historical_csv.exists()
    source_csv = historical_csv if use_historical else demo_csv

    db = SessionLocal()
    try:
        existing_count = db.query(DatasetRecord).count()
        if existing_count == 0:
            df, report = preprocess_csv_dataset(source_csv)
            ds = DatasetRecord(
                name=(
                    "NER Historical Landslide Catalog + ERA5-Land Weather (2022-2024)"
                    if use_historical
                    else "NER Synthetic Demonstration Benchmark (SIH 26001)"
                ),
                file_type="csv+era5+dem" if use_historical else "csv+geotiff+geojson",
                file_path=str(source_csv),
                row_count=int(len(df)),
                missing_values_imputed=int(report.get("missing_values_imputed", 0)),
                crs="EPSG:4326",
                is_demonstration=not use_historical,
                is_active=True,
                summary_json=json.dumps(report),
            )
            db.add(ds)
            db.commit()
            db.refresh(ds)

            observations = [
                ZoneObservation(
                    dataset_id=ds.id,
                    state=str(row["state"]),
                    district=str(row["district"]),
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    rainfall_mm=float(row["rainfall_mm"]),
                    temperature_c=float(row.get("temperature_c", 22.0)),
                    humidity_pct=float(row.get("humidity_pct", 78.0)),
                    elevation_m=float(row["elevation_m"]),
                    slope_deg=float(row["slope_deg"]),
                    soil_moisture_pct=float(row["soil_moisture_pct"]),
                    ndvi=float(row["ndvi"]),
                    distance_to_road_m=float(row["distance_to_road_m"]),
                    susceptibility_class=str(row["susceptibility_class"]),
                    observed_date=str(row["observed_date"]) if row.get("observed_date") else None,
                    event_source=str(row["event_source"]) if row.get("event_source") else None,
                    is_demonstration=not use_historical,
                )
                for _, row in df.iterrows()
            ]
            db.add_all(observations)
            db.commit()

            eval_results = train_and_evaluate_models(observations, dataset_id=ds.id)
            for res in eval_results:
                db.add(
                    ModelEvaluationRun(
                        dataset_id=ds.id,
                        model_key=res["model_key"],
                        model_name=res["model_name"],
                        train_samples=res["train_samples"],
                        test_samples=res["test_samples"],
                        train_accuracy=res["train_accuracy"],
                        accuracy=res["accuracy"],
                        precision_weighted=res["precision_weighted"],
                        recall_weighted=res["recall_weighted"],
                        f1_weighted=res["f1_weighted"],
                        per_class_metrics_json=json.dumps(res["per_class_metrics"]),
                        confusion_matrix_json=json.dumps(res["confusion_matrix"]),
                        feature_importance_json=json.dumps(res["feature_importances"]),
                        artifact_path=res["artifact_path"],
                        is_demonstration_trained=not use_historical,
                    )
                )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    bootstrap_database()
    yield


app = FastAPI(
    title="NER Landslide Risk Prediction & Monitoring API (SIH 26001)",
    description="FastAPI + GeoPandas + Rasterio + Scikit-learn + Joblib + Open-Meteo backend for North Eastern Region landslide susceptibility assessment.",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(regions.router)
app.include_router(datasets.router)
app.include_router(models_ml.router)
app.include_router(predictions.router)
app.include_router(weather.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "ner-landslide-fastapi",
        "problem_statement": "SIH 26001",
    }
