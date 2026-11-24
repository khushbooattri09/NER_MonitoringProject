import json
from typing import Any, Dict, List, Optional
import numpy as np
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.config import HISTORICAL_DIR, SUSCEPTIBILITY_CLASSES
from backend.database import get_db
from backend.models import DatasetRecord, PredictionHistory, ZoneObservation
from backend.schemas import (
    DistrictSummary,
    EnvironmentalProfilesResponse,
    ObservationOut,
    RegionOverviewResponse,
    StateMetadata,
)
from backend.services.geospatial import build_state_geojson_with_stats
from backend.services.ner_reference import NER_REFERENCE

router = APIRouter(prefix="/api/regions", tags=["regions"])


def _get_active_dataset(db: Session) -> Optional[DatasetRecord]:
    ds = (
        db.query(DatasetRecord)
        .filter(DatasetRecord.is_active.is_(True))
        .order_by(DatasetRecord.id.desc())
        .first()
    )
    if not ds:
        ds = db.query(DatasetRecord).order_by(DatasetRecord.id.desc()).first()
    return ds


def _dominant_class(items: List[ZoneObservation]) -> str:
    counts = {c: 0 for c in SUSCEPTIBILITY_CLASSES}
    for item in items:
        counts[item.susceptibility_class] = counts.get(item.susceptibility_class, 0) + 1
    if counts["High"] >= counts["Medium"] and counts["High"] >= counts["Low"]:
        return "High"
    if counts["Medium"] >= counts["Low"]:
        return "Medium"
    return "Low"


def _load_dataset_limitations(ds: DatasetRecord) -> List[str]:
    meta_path = HISTORICAL_DIR / "ner_historical_metadata.json"
    if not ds.is_demonstration and meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if isinstance(meta.get("limitations"), list):
                return [str(x) for x in meta["limitations"]]
        except Exception:
            pass
    if ds.is_demonstration:
        return [
            "Synthetic demonstration benchmark generated for pipeline testing; replace with verified GSI/IMD field surveys for operational use.",
            "Missing numeric attributes are median-imputed during Scikit-learn preprocessing.",
        ]
    return [
        "Uploaded dataset records are cleaned via median imputation for any missing numerical features.",
        "Model predictions reflect patterns present in the uploaded dataset and should be validated with local geotechnical expertise.",
    ]


@router.get("/overview", response_model=RegionOverviewResponse)
def get_region_overview(
    state: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    active_ds = _get_active_dataset(db)
    if not active_ds:
        return RegionOverviewResponse(
            active_dataset_id=None,
            active_dataset_name="No dataset loaded",
            is_demonstration=True,
            provenance_notice="No dataset currently active in database.",
            total_observations=0,
            class_distribution={"Low": 0, "Medium": 0, "High": 0},
            states=[
                StateMetadata(
                    state=s["state"],
                    code=s["code"],
                    capital=s["capital"],
                    center_lat=s["center_lat"],
                    center_lon=s["center_lon"],
                    districts=[d["name"] for d in s["districts"]],
                )
                for s in NER_REFERENCE
            ],
            district_summaries=[],
            limitations=[],
            missing_values_imputed=0,
            latest_data_update=None,
        )

    query = db.query(ZoneObservation).filter(ZoneObservation.dataset_id == active_ds.id)
    if state and state != "All":
        query = query.filter(ZoneObservation.state == state)
    if district and district != "All":
        query = query.filter(ZoneObservation.district == district)

    observations = query.all()
    class_dist = {c: 0 for c in SUSCEPTIBILITY_CLASSES}
    grouped: Dict[tuple, List[ZoneObservation]] = {}
    for obs in observations:
        class_dist[obs.susceptibility_class] = class_dist.get(obs.susceptibility_class, 0) + 1
        grouped.setdefault((obs.state, obs.district), []).append(obs)

    district_summaries: List[DistrictSummary] = []
    for (st_name, dist_name), items in sorted(grouped.items()):
        cnt = len(items)
        high_cnt = sum(1 for i in items if i.susceptibility_class == "High")
        district_summaries.append(
            DistrictSummary(
                state=st_name,
                district=dist_name,
                latitude=round(sum(i.latitude for i in items) / cnt, 4),
                longitude=round(sum(i.longitude for i in items) / cnt, 4),
                observation_count=cnt,
                mean_rainfall_mm=round(sum(i.rainfall_mm for i in items) / cnt, 1),
                mean_elevation_m=round(sum(i.elevation_m for i in items) / cnt, 1),
                mean_slope_deg=round(sum(i.slope_deg for i in items) / cnt, 1),
                dominant_susceptibility=_dominant_class(items),
                high_risk_share_pct=round((high_cnt / cnt) * 100.0, 1),
                is_demonstration=active_ds.is_demonstration,
            )
        )

    provenance = (
        "DEMONSTRATION DATA: Synthetic NER GeoTIFF/GeoJSON benchmark generated for SIH 26001 pipeline verification. Upload a verified geological inventory CSV, GeoJSON, or GeoTIFF DEM to replace."
        if active_ds.is_demonstration
        else f"HISTORICAL / FIELD DATASET: '{active_ds.name}' cleaned via Pandas/GeoPandas ({active_ds.missing_values_imputed} missing values imputed) and persisted in SQLite."
    )

    latest_pred = db.query(PredictionHistory).order_by(PredictionHistory.created_at.desc()).first()
    latest_update = latest_pred.created_at if latest_pred and latest_pred.created_at > active_ds.created_at else active_ds.created_at

    return RegionOverviewResponse(
        active_dataset_id=active_ds.id,
        active_dataset_name=active_ds.name,
        is_demonstration=active_ds.is_demonstration,
        provenance_notice=provenance,
        total_observations=len(observations),
        class_distribution=class_dist,
        states=[
            StateMetadata(
                state=s["state"],
                code=s["code"],
                capital=s["capital"],
                center_lat=s["center_lat"],
                center_lon=s["center_lon"],
                districts=[d["name"] for d in s["districts"]],
            )
            for s in NER_REFERENCE
        ],
        district_summaries=district_summaries,
        limitations=_load_dataset_limitations(active_ds),
        missing_values_imputed=active_ds.missing_values_imputed,
        latest_data_update=latest_update,
    )


@router.get("/geojson")
def get_ner_geojson(
    state: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    active_ds = _get_active_dataset(db)
    if not active_ds:
        return build_state_geojson_with_stats([], is_demonstration=True)

    query = db.query(ZoneObservation).filter(ZoneObservation.dataset_id == active_ds.id)
    if state and state != "All":
        query = query.filter(ZoneObservation.state == state)
    observations = query.all()
    return build_state_geojson_with_stats(observations, is_demonstration=active_ds.is_demonstration)


def _compute_histogram_bins(
    observations: List[ZoneObservation], attr: str, num_bins: int = 6, unit: str = ""
) -> List[Dict[str, Any]]:
    if not observations:
        return []
    values = np.array([float(getattr(o, attr)) for o in observations])
    v_min, v_max = float(np.min(values)), float(np.max(values))
    if v_min == v_max:
        v_max = v_min + 1.0
    edges = np.linspace(v_min, v_max, num_bins + 1)

    bins = []
    for i in range(num_bins):
        lo, hi = float(edges[i]), float(edges[i + 1])
        is_last = i == num_bins - 1
        bucket = [
            o
            for o in observations
            if (lo <= getattr(o, attr) <= hi if is_last else lo <= getattr(o, attr) < hi)
        ]
        bins.append(
            {
                "range": f"{round(lo)}–{round(hi)}{unit}",
                "Low": sum(1 for o in bucket if o.susceptibility_class == "Low"),
                "Medium": sum(1 for o in bucket if o.susceptibility_class == "Medium"),
                "High": sum(1 for o in bucket if o.susceptibility_class == "High"),
                "total": len(bucket),
            }
        )
    return bins


def _compute_historical_trends(observations: List[ZoneObservation]) -> List[Dict[str, Any]]:
    dated = [o for o in observations if o.observed_date and len(o.observed_date) >= 7]
    if not dated:
        return []

    by_month: Dict[str, List[ZoneObservation]] = {}
    for o in dated:
        ym = o.observed_date[:7]
        by_month.setdefault(ym, []).append(o)

    trends: List[Dict[str, Any]] = []
    for ym in sorted(by_month.keys()):
        items = by_month[ym]
        cnt = len(items)
        trends.append(
            {
                "period": ym,
                "mean_rainfall_mm": round(sum(i.rainfall_mm for i in items) / cnt, 1),
                "mean_soil_moisture_pct": round(sum(i.soil_moisture_pct for i in items) / cnt, 1),
                "mean_humidity_pct": round(
                    sum((i.humidity_pct or 75.0) for i in items) / cnt, 1
                ),
                "high_risk_events": sum(1 for i in items if i.susceptibility_class == "High"),
                "medium_risk_events": sum(1 for i in items if i.susceptibility_class == "Medium"),
                "low_risk_events": sum(1 for i in items if i.susceptibility_class == "Low"),
                "total_records": cnt,
            }
        )
    return trends


@router.get("/environmental", response_model=EnvironmentalProfilesResponse)
def get_environmental_profiles(
    state: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    active_ds = _get_active_dataset(db)
    if not active_ds:
        return EnvironmentalProfilesResponse(
            is_demonstration=True,
            state_filter=state,
            district_filter=district,
            observations=[],
            rainfall_bins=[],
            elevation_bins=[],
            slope_bins=[],
            state_aggregates=[],
            historical_trends=[],
        )

    all_obs = db.query(ZoneObservation).filter(ZoneObservation.dataset_id == active_ds.id).all()
    filtered = [
        o
        for o in all_obs
        if (not state or state == "All" or o.state == state)
        and (not district or district == "All" or o.district == district)
    ]

    state_groups: Dict[str, List[ZoneObservation]] = {}
    for o in all_obs:
        state_groups.setdefault(o.state, []).append(o)

    state_aggregates = []
    for st_name, items in sorted(state_groups.items()):
        cnt = len(items)
        state_aggregates.append(
            {
                "state": st_name,
                "mean_rainfall_mm": round(sum(i.rainfall_mm for i in items) / cnt, 1),
                "mean_elevation_m": round(sum(i.elevation_m for i in items) / cnt, 1),
                "mean_slope_deg": round(sum(i.slope_deg for i in items) / cnt, 1),
                "high_risk_count": sum(1 for i in items if i.susceptibility_class == "High"),
                "total": cnt,
            }
        )

    obs_out = [
        ObservationOut(
            id=o.id,
            state=o.state,
            district=o.district,
            latitude=o.latitude,
            longitude=o.longitude,
            rainfall_mm=o.rainfall_mm,
            temperature_c=o.temperature_c,
            humidity_pct=o.humidity_pct,
            elevation_m=o.elevation_m,
            slope_deg=o.slope_deg,
            soil_moisture_pct=o.soil_moisture_pct,
            ndvi=o.ndvi,
            distance_to_road_m=o.distance_to_road_m,
            susceptibility_class=o.susceptibility_class,
            observed_date=o.observed_date,
            event_source=o.event_source,
            is_demonstration=o.is_demonstration,
        )
        for o in filtered
    ]

    return EnvironmentalProfilesResponse(
        is_demonstration=active_ds.is_demonstration,
        state_filter=state,
        district_filter=district,
        observations=obs_out,
        rainfall_bins=_compute_histogram_bins(filtered, "rainfall_mm", 6, "mm"),
        elevation_bins=_compute_histogram_bins(filtered, "elevation_m", 6, "m"),
        slope_bins=_compute_histogram_bins(filtered, "slope_deg", 6, "°"),
        state_aggregates=state_aggregates,
        historical_trends=_compute_historical_trends(filtered),
    )
