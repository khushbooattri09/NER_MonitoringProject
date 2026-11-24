import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.config import SUSCEPTIBILITY_CLASSES
from backend.database import get_db
from backend.models import DatasetRecord, ModelEvaluationRun, ZoneObservation
from backend.schemas import (
    FeatureImportanceItem,
    ModelEvaluationOut,
    PerClassMetric,
    TrainModelsRequest,
    TrainModelsResponse,
)
from backend.services.ml_pipeline import train_and_evaluate_models

router = APIRouter(prefix="/api/models", tags=["models"])


def _serialize_run(run: ModelEvaluationRun) -> ModelEvaluationOut:
    per_class_raw = json.loads(run.per_class_metrics_json)
    cm_raw = json.loads(run.confusion_matrix_json)
    fi_raw = json.loads(run.feature_importance_json)
    return ModelEvaluationOut(
        id=run.id,
        dataset_id=run.dataset_id,
        model_key=run.model_key,
        model_name=run.model_name,
        train_samples=run.train_samples,
        test_samples=run.test_samples,
        train_accuracy=run.train_accuracy,
        accuracy=run.accuracy,
        precision_weighted=run.precision_weighted,
        recall_weighted=run.recall_weighted,
        f1_weighted=run.f1_weighted,
        per_class_metrics=[PerClassMetric(**item) for item in per_class_raw],
        confusion_matrix=cm_raw,
        class_labels=SUSCEPTIBILITY_CLASSES,
        feature_importances=[FeatureImportanceItem(**item) for item in fi_raw],
        is_demonstration_trained=run.is_demonstration_trained,
        trained_at=run.trained_at,
    )


@router.get("/evaluations", response_model=List[ModelEvaluationOut])
def get_model_evaluations(
    dataset_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    if dataset_id is None:
        active_ds = (
            db.query(DatasetRecord)
            .filter(DatasetRecord.is_active.is_(True))
            .order_by(DatasetRecord.id.desc())
            .first()
        )
        if not active_ds:
            return []
        dataset_id = active_ds.id

    runs = (
        db.query(ModelEvaluationRun)
        .filter(ModelEvaluationRun.dataset_id == dataset_id)
        .order_by(ModelEvaluationRun.id.desc())
        .all()
    )

    # Keep only the most recent run per model_key
    latest_by_key = {}
    for r in runs:
        if r.model_key not in latest_by_key:
            latest_by_key[r.model_key] = r

    order = ["logistic_regression", "decision_tree", "random_forest"]
    ordered = [latest_by_key[k] for k in order if k in latest_by_key]
    return [_serialize_run(r) for r in ordered]


@router.post("/train", response_model=TrainModelsResponse)
def train_models(payload: TrainModelsRequest, db: Session = Depends(get_db)):
    if payload.dataset_id is not None:
        target_ds = db.query(DatasetRecord).filter(DatasetRecord.id == payload.dataset_id).first()
    else:
        target_ds = (
            db.query(DatasetRecord)
            .filter(DatasetRecord.is_active.is_(True))
            .order_by(DatasetRecord.id.desc())
            .first()
        )

    if not target_ds:
        raise HTTPException(status_code=404, detail="No active dataset available for training.")

    observations = (
        db.query(ZoneObservation).filter(ZoneObservation.dataset_id == target_ds.id).all()
    )
    if len(observations) < 15:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset '{target_ds.name}' has {len(observations)} rows; at least 15 rows are required for train/test evaluation.",
        )

    try:
        eval_results = train_and_evaluate_models(
            observations=observations,
            dataset_id=target_ds.id,
            test_size=payload.test_size,
            random_state=payload.random_state,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model training failed: {exc}")

    created_runs: List[ModelEvaluationRun] = []
    for res in eval_results:
        run = ModelEvaluationRun(
            dataset_id=target_ds.id,
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
            is_demonstration_trained=target_ds.is_demonstration,
        )
        db.add(run)
        created_runs.append(run)

    db.commit()
    for r in created_runs:
        db.refresh(r)

    return TrainModelsResponse(
        dataset_id=target_ds.id,
        dataset_name=target_ds.name,
        is_demonstration_trained=target_ds.is_demonstration,
        models=[_serialize_run(r) for r in created_runs],
    )
