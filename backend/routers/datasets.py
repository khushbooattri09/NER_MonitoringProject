import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.config import UPLOADS_DIR
from backend.database import get_db
from backend.models import DatasetRecord, ModelEvaluationRun, ZoneObservation
from backend.schemas import DatasetSummaryOut, DatasetUploadResponse
from backend.services.geospatial import (
    DEMO_CSV_PATH,
    ensure_demonstration_assets,
    preprocess_csv_dataset,
    preprocess_geojson_dataset,
    preprocess_geotiff_dataset,
)
from backend.services.ml_pipeline import train_and_evaluate_models

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _serialize_dataset(ds: DatasetRecord) -> DatasetSummaryOut:
    summary = {}
    if ds.summary_json:
        try:
            summary = json.loads(ds.summary_json)
        except json.JSONDecodeError:
            summary = {}
    return DatasetSummaryOut(
        id=ds.id,
        name=ds.name,
        file_type=ds.file_type,
        row_count=ds.row_count,
        missing_values_imputed=ds.missing_values_imputed,
        crs=ds.crs,
        is_demonstration=ds.is_demonstration,
        is_active=ds.is_active,
        summary=summary,
        created_at=ds.created_at,
    )


def _persist_observations_and_train(
    db: Session,
    df: pd.DataFrame,
    dataset: DatasetRecord,
) -> None:
    observations: List[ZoneObservation] = []
    for _, row in df.iterrows():
        obs_date = row.get("observed_date")
        ev_src = row.get("event_source")
        obs = ZoneObservation(
            dataset_id=dataset.id,
            state=str(row["state"]),
            district=str(row["district"]),
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            rainfall_mm=float(row["rainfall_mm"]),
            temperature_c=float(row["temperature_c"]) if pd.notna(row.get("temperature_c")) else 22.0,
            humidity_pct=float(row["humidity_pct"]) if pd.notna(row.get("humidity_pct")) else 78.0,
            elevation_m=float(row["elevation_m"]),
            slope_deg=float(row["slope_deg"]),
            soil_moisture_pct=float(row["soil_moisture_pct"]),
            ndvi=float(row["ndvi"]),
            distance_to_road_m=float(row["distance_to_road_m"]),
            susceptibility_class=str(row["susceptibility_class"]),
            observed_date=str(obs_date) if pd.notna(obs_date) and obs_date else None,
            event_source=str(ev_src) if pd.notna(ev_src) and ev_src else None,
            is_demonstration=dataset.is_demonstration,
        )
        observations.append(obs)

    db.add_all(observations)
    db.commit()

    if len(observations) >= 15:
        eval_results = train_and_evaluate_models(observations, dataset_id=dataset.id)
        for res in eval_results:
            run = ModelEvaluationRun(
                dataset_id=dataset.id,
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
                is_demonstration_trained=dataset.is_demonstration,
            )
            db.add(run)
        db.commit()


@router.get("", response_model=List[DatasetSummaryOut])
def list_datasets(db: Session = Depends(get_db)):
    records = db.query(DatasetRecord).order_by(DatasetRecord.id.desc()).all()
    return [_serialize_dataset(r) for r in records]


@router.get("/sample-csv")
def download_sample_csv():
    ensure_demonstration_assets()
    return FileResponse(
        path=str(DEMO_CSV_PATH),
        media_type="text/csv",
        filename="ner_landslide_demonstration_template.csv",
    )


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a valid filename.")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".csv", ".geojson", ".json", ".tif", ".tiff"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Upload .csv, .geojson/.json, or .tif/.tiff (GeoTIFF DEM).",
        )

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_name = Path(file.filename).name.replace(" ", "_")
    dest_path = UPLOADS_DIR / f"{ts}_{safe_name}"

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    dest_path.write_bytes(content)

    try:
        if ext == ".csv":
            df, report = preprocess_csv_dataset(dest_path)
            file_type = "csv"
        elif ext in {".geojson", ".json"}:
            df, report = preprocess_geojson_dataset(dest_path)
            file_type = "geojson"
        else:
            df, report = preprocess_geotiff_dataset(dest_path)
            file_type = "geotiff"
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Geospatial/tabular preprocessing failed: {exc}")

    # Deactivate existing active datasets
    db.query(DatasetRecord).update({DatasetRecord.is_active: False})

    ds_record = DatasetRecord(
        name=dataset_name.strip() if dataset_name and dataset_name.strip() else Path(file.filename).stem,
        file_type=file_type,
        file_path=str(dest_path),
        row_count=int(len(df)),
        missing_values_imputed=int(report.get("missing_values_imputed", 0)),
        crs=str(report.get("crs", "EPSG:4326")),
        is_demonstration=False,
        is_active=True,
        summary_json=json.dumps(report),
    )
    db.add(ds_record)
    db.commit()
    db.refresh(ds_record)

    _persist_observations_and_train(db, df, ds_record)

    return DatasetUploadResponse(
        dataset=_serialize_dataset(ds_record),
        preprocessing_report=report,
        message=f"Successfully preprocessed {len(df)} records using {report.get('processor')} and updated ML models.",
    )


@router.post("/{dataset_id}/activate", response_model=DatasetSummaryOut)
def activate_dataset(dataset_id: int, db: Session = Depends(get_db)):
    target = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    db.query(DatasetRecord).update({DatasetRecord.is_active: False})
    target.is_active = True
    db.commit()
    db.refresh(target)

    # Ensure model runs exist for this dataset
    existing_runs = db.query(ModelEvaluationRun).filter(ModelEvaluationRun.dataset_id == target.id).count()
    if existing_runs == 0:
        obs = db.query(ZoneObservation).filter(ZoneObservation.dataset_id == target.id).all()
        if len(obs) >= 15:
            eval_results = train_and_evaluate_models(obs, dataset_id=target.id)
            for res in eval_results:
                db.add(
                    ModelEvaluationRun(
                        dataset_id=target.id,
                        model_key=res["model_key"],
                        model_name=res["model_name"],
                        train_samples=res["train_samples"],
                        test_samples=res["test_samples"],
                        accuracy=res["accuracy"],
                        precision_weighted=res["precision_weighted"],
                        recall_weighted=res["recall_weighted"],
                        f1_weighted=res["f1_weighted"],
                        per_class_metrics_json=json.dumps(res["per_class_metrics"]),
                        confusion_matrix_json=json.dumps(res["confusion_matrix"]),
                        feature_importance_json=json.dumps(res["feature_importances"]),
                        artifact_path=res["artifact_path"],
                        is_demonstration_trained=target.is_demonstration,
                    )
                )
            db.commit()

    return _serialize_dataset(target)


@router.post("/reset-demo", response_model=DatasetSummaryOut)
def reset_demonstration_dataset(db: Session = Depends(get_db)):
    demo_ds = (
        db.query(DatasetRecord)
        .filter(DatasetRecord.is_demonstration.is_(True))
        .order_by(DatasetRecord.id.asc())
        .first()
    )
    if demo_ds:
        return activate_dataset(demo_ds.id, db)

    _, _, demo_csv = ensure_demonstration_assets()
    df, report = preprocess_csv_dataset(demo_csv)
    db.query(DatasetRecord).update({DatasetRecord.is_active: False})
    ds_record = DatasetRecord(
        name="NER Synthetic Demonstration Benchmark (SIH 26001)",
        file_type="csv+geotiff+geojson",
        file_path=str(demo_csv),
        row_count=int(len(df)),
        missing_values_imputed=int(report.get("missing_values_imputed", 0)),
        crs="EPSG:4326",
        is_demonstration=True,
        is_active=True,
        summary_json=json.dumps(report),
    )
    db.add(ds_record)
    db.commit()
    db.refresh(ds_record)
    _persist_observations_and_train(db, df, ds_record)
    return _serialize_dataset(ds_record)
