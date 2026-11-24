import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DatasetRecord, ModelEvaluationRun, PredictionHistory
from backend.schemas import (
    AlertItem,
    AlertsResponse,
    InfluencingFactor,
    LivePredictRequest,
    LivePredictResponse,
    LiveWeatherReading,
    PredictRequest,
    PredictResponse,
    RuleAdvisory,
)
from backend.services.ml_pipeline import evaluate_rule_based_advisory, predict_susceptibility
from backend.services.weather_service import fetch_all_states_live_weather, fetch_live_weather

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

MODEL_NAMES = {
    "logistic_regression": "Logistic Regression",
    "decision_tree": "Decision Tree Classifier",
    "random_forest": "Random Forest Classifier",
}


def _get_active_model_run(db: Session, model_key: str) -> tuple[DatasetRecord, ModelEvaluationRun]:
    active_ds = (
        db.query(DatasetRecord)
        .filter(DatasetRecord.is_active.is_(True))
        .order_by(DatasetRecord.id.desc())
        .first()
    )
    if not active_ds:
        raise HTTPException(status_code=404, detail="No active dataset found.")

    run = (
        db.query(ModelEvaluationRun)
        .filter(
            ModelEvaluationRun.dataset_id == active_ds.id,
            ModelEvaluationRun.model_key == model_key,
        )
        .order_by(ModelEvaluationRun.id.desc())
        .first()
    )
    if not run:
        raise HTTPException(
            status_code=404,
            detail=f"No trained '{model_key}' model found for active dataset. Trigger training first.",
        )
    return active_ds, run


def _serialize_history_row(r: PredictionHistory) -> PredictResponse:
    factors_raw = []
    if r.influencing_factors_json:
        try:
            factors_raw = json.loads(r.influencing_factors_json)
        except Exception:
            factors_raw = []

    advisory_obj: Optional[RuleAdvisory] = None
    if r.rule_advisory_json:
        try:
            advisory_obj = RuleAdvisory(**json.loads(r.rule_advisory_json))
        except Exception:
            advisory_obj = None

    return PredictResponse(
        prediction_id=r.id,
        model_key=r.model_key,
        model_name=MODEL_NAMES.get(r.model_key, r.model_key),
        state=r.state,
        district=r.district,
        predicted_class=r.predicted_class,
        probabilities=json.loads(r.probabilities_json),
        rainfall_mm=r.rainfall_mm,
        temperature_c=r.temperature_c,
        humidity_pct=r.humidity_pct,
        soil_moisture_pct=r.soil_moisture_pct,
        elevation_m=r.elevation_m,
        slope_deg=r.slope_deg,
        weather_source=r.weather_source or "Manual Input",
        influencing_factors=[InfluencingFactor(**f) for f in factors_raw],
        rule_advisory=advisory_obj,
        is_demonstration_model=r.is_demonstration_model,
        disclaimer=(
            "DEMONSTRATION MODEL OUTPUT: Trained on synthetic benchmark data."
            if r.is_demonstration_model
            else "Computed by Joblib-persisted Scikit-learn model trained on NER historical dataset."
        ),
        created_at=r.created_at,
    )


def _execute_and_persist_prediction(
    db: Session,
    active_ds: DatasetRecord,
    run: ModelEvaluationRun,
    state: str,
    district: str,
    rainfall_mm: float,
    rainfall_24h_mm: Optional[float],
    temperature_c: Optional[float],
    humidity_pct: Optional[float],
    soil_moisture_pct: Optional[float],
    elevation_m: float,
    slope_deg: float,
    ndvi: float,
    distance_to_road_m: float,
    weather_source: str,
) -> PredictResponse:
    try:
        predicted_class, probabilities, factors = predict_susceptibility(
            artifact_path=run.artifact_path,
            model_key=run.model_key,
            payload={
                "rainfall_mm": rainfall_mm,
                "temperature_c": temperature_c,
                "humidity_pct": humidity_pct,
                "soil_moisture_pct": soil_moisture_pct,
                "elevation_m": elevation_m,
                "slope_deg": slope_deg,
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")

    rule_advisory = evaluate_rule_based_advisory(
        rainfall_7d_mm=rainfall_mm,
        rainfall_24h_mm=rainfall_24h_mm,
        slope_deg=slope_deg,
        soil_moisture_pct=soil_moisture_pct,
    )

    history_row = PredictionHistory(
        model_run_id=run.id,
        model_key=run.model_key,
        state=state,
        district=district,
        rainfall_mm=rainfall_mm,
        temperature_c=temperature_c,
        humidity_pct=humidity_pct,
        elevation_m=elevation_m,
        slope_deg=slope_deg,
        soil_moisture_pct=soil_moisture_pct,
        ndvi=ndvi,
        distance_to_road_m=distance_to_road_m,
        predicted_class=predicted_class,
        probabilities_json=json.dumps(probabilities),
        weather_source=weather_source,
        influencing_factors_json=json.dumps(factors),
        rule_advisory_json=json.dumps(rule_advisory),
        is_demonstration_model=run.is_demonstration_trained,
    )
    db.add(history_row)
    db.commit()
    db.refresh(history_row)

    disclaimer = (
        "DEMONSTRATION MODEL OUTPUT: Computed by a Joblib-saved Scikit-learn model trained on synthetic demonstration data. Do not use for operational evacuation decisions."
        if run.is_demonstration_trained
        else f"Computed by Joblib-saved {run.model_name} trained on '{active_ds.name}'."
    )

    return PredictResponse(
        prediction_id=history_row.id,
        model_key=run.model_key,
        model_name=run.model_name,
        state=state,
        district=district,
        predicted_class=predicted_class,
        probabilities=probabilities,
        rainfall_mm=rainfall_mm,
        temperature_c=temperature_c,
        humidity_pct=humidity_pct,
        soil_moisture_pct=soil_moisture_pct,
        elevation_m=elevation_m,
        slope_deg=slope_deg,
        weather_source=weather_source,
        influencing_factors=[InfluencingFactor(**f) for f in factors],
        rule_advisory=RuleAdvisory(**rule_advisory),
        is_demonstration_model=run.is_demonstration_trained,
        disclaimer=disclaimer,
        created_at=history_row.created_at,
    )


@router.post("/predict", response_model=PredictResponse)
def run_prediction(payload: PredictRequest, db: Session = Depends(get_db)):
    active_ds, run = _get_active_model_run(db, payload.model_key)
    return _execute_and_persist_prediction(
        db=db,
        active_ds=active_ds,
        run=run,
        state=payload.state,
        district=payload.district,
        rainfall_mm=payload.rainfall_mm,
        rainfall_24h_mm=None,
        temperature_c=payload.temperature_c,
        humidity_pct=payload.humidity_pct,
        soil_moisture_pct=payload.soil_moisture_pct,
        elevation_m=payload.elevation_m,
        slope_deg=payload.slope_deg,
        ndvi=payload.ndvi,
        distance_to_road_m=payload.distance_to_road_m,
        weather_source=payload.weather_source or "Manual Simulator Input",
    )


@router.post("/predict-live", response_model=LivePredictResponse)
async def run_live_weather_prediction(payload: LivePredictRequest, db: Session = Depends(get_db)):
    active_ds, run = _get_active_model_run(db, payload.model_key)
    weather = await fetch_live_weather(
        state=payload.state,
        district=payload.district,
        force_refresh=payload.force_refresh,
    )

    prediction = _execute_and_persist_prediction(
        db=db,
        active_ds=active_ds,
        run=run,
        state=weather["state"],
        district=weather["district"],
        rainfall_mm=weather["rainfall_7d_mm"],
        rainfall_24h_mm=weather["rainfall_24h_mm"],
        temperature_c=weather["temperature_c"],
        humidity_pct=weather["humidity_pct"],
        soil_moisture_pct=weather["soil_moisture_pct"],
        elevation_m=weather["elevation_m"],
        slope_deg=weather["slope_deg"],
        ndvi=0.45,
        distance_to_road_m=250.0,
        weather_source=weather["source"],
    )

    return LivePredictResponse(
        prediction=prediction,
        weather=LiveWeatherReading(**weather),
    )


@router.get("/history", response_model=List[PredictResponse])
def get_prediction_history(limit: int = 25, db: Session = Depends(get_db)):
    rows = (
        db.query(PredictionHistory)
        .order_by(PredictionHistory.id.desc())
        .limit(min(limit, 100))
        .all()
    )
    return [_serialize_history_row(r) for r in rows]


@router.get("/alerts", response_model=AlertsResponse)
async def get_early_warning_alerts(db: Session = Depends(get_db)):
    # 1. ML High-Risk Predictions from SQLite history
    high_rows = (
        db.query(PredictionHistory)
        .filter(PredictionHistory.predicted_class == "High")
        .order_by(PredictionHistory.id.desc())
        .limit(10)
        .all()
    )

    ml_alerts = [
        AlertItem(
            id=f"ml-{r.id}",
            category="ML_HIGH_RISK",
            source_label=f"{MODEL_NAMES.get(r.model_key, r.model_key)} (Joblib)",
            state=r.state,
            district=r.district,
            risk_level="HIGH",
            message=f"ML model classified {r.district}, {r.state} as HIGH landslide risk (7d rain: {r.rainfall_mm:.1f} mm, slope: {r.slope_deg:.1f}°).",
            rainfall_mm=r.rainfall_mm,
            temperature_c=r.temperature_c,
            humidity_pct=r.humidity_pct,
            timestamp=r.created_at,
        )
        for r in high_rows
    ]

    # 2. Separate Rule-Based Weather Threshold Advisories across 8 NER state stations
    station_weather = await fetch_all_states_live_weather(force_refresh=False)
    rule_advisories: List[AlertItem] = []
    any_demo = any(w["is_demo_fallback"] for w in station_weather)
    source_label = (
        "Demo Mode (Weather API Unavailable)"
        if any_demo
        else "Open-Meteo Live Weather API"
    )

    for w in station_weather:
        adv = evaluate_rule_based_advisory(
            rainfall_7d_mm=w["rainfall_7d_mm"],
            rainfall_24h_mm=w["rainfall_24h_mm"],
            slope_deg=w["slope_deg"],
            soil_moisture_pct=w["soil_moisture_pct"],
        )
        if adv["triggered"]:
            rule_advisories.append(
                AlertItem(
                    id=f"rule-{w['state']}-{w['district']}",
                    category="RULE_THRESHOLD",
                    source_label=f"Rule-Based Weather Check ({w['source']})",
                    state=w["state"],
                    district=w["district"],
                    risk_level=adv["level"],
                    message=" ".join(adv["reasons"]),
                    rainfall_mm=w["rainfall_7d_mm"],
                    temperature_c=w["temperature_c"],
                    humidity_pct=w["humidity_pct"],
                    timestamp=w["observed_at"],
                )
            )

    return AlertsResponse(
        ml_high_risk_alerts=ml_alerts,
        rule_based_advisories=rule_advisories,
        weather_source=source_label,
        is_demo_fallback=any_demo,
        generated_at=datetime.now(timezone.utc),
    )
