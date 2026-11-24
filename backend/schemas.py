from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DistrictSummary(BaseModel):
    state: str
    district: str
    latitude: float
    longitude: float
    observation_count: int
    mean_rainfall_mm: float
    mean_elevation_m: float
    mean_slope_deg: float
    dominant_susceptibility: str
    high_risk_share_pct: float
    is_demonstration: bool


class StateMetadata(BaseModel):
    state: str
    code: str
    capital: str
    center_lat: float
    center_lon: float
    districts: List[str]


class RegionOverviewResponse(BaseModel):
    active_dataset_id: Optional[int]
    active_dataset_name: str
    is_demonstration: bool
    provenance_notice: str
    total_observations: int
    class_distribution: Dict[str, int]
    states: List[StateMetadata]
    district_summaries: List[DistrictSummary]
    limitations: List[str] = Field(default_factory=list)
    missing_values_imputed: int = 0
    latest_data_update: Optional[datetime] = None


class ObservationOut(BaseModel):
    id: int
    state: str
    district: str
    latitude: float
    longitude: float
    rainfall_mm: float
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    elevation_m: float
    slope_deg: float
    soil_moisture_pct: float
    ndvi: float
    distance_to_road_m: float
    susceptibility_class: str
    observed_date: Optional[str] = None
    event_source: Optional[str] = None
    is_demonstration: bool


class EnvironmentalProfilesResponse(BaseModel):
    is_demonstration: bool
    state_filter: Optional[str]
    district_filter: Optional[str]
    observations: List[ObservationOut]
    rainfall_bins: List[Dict[str, Any]]
    elevation_bins: List[Dict[str, Any]]
    slope_bins: List[Dict[str, Any]]
    state_aggregates: List[Dict[str, Any]]
    historical_trends: List[Dict[str, Any]] = Field(default_factory=list)


class DatasetSummaryOut(BaseModel):
    id: int
    name: str
    file_type: str
    row_count: int
    missing_values_imputed: int
    crs: Optional[str]
    is_demonstration: bool
    is_active: bool
    summary: Dict[str, Any]
    created_at: datetime


class DatasetUploadResponse(BaseModel):
    dataset: DatasetSummaryOut
    preprocessing_report: Dict[str, Any]
    message: str


class PerClassMetric(BaseModel):
    label: str
    precision: float
    recall: float
    f1_score: float
    support: int


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float


class ModelEvaluationOut(BaseModel):
    id: int
    dataset_id: int
    model_key: str
    model_name: str
    train_samples: int
    test_samples: int
    train_accuracy: Optional[float] = None
    accuracy: float
    precision_weighted: float
    recall_weighted: float
    f1_weighted: float
    per_class_metrics: List[PerClassMetric]
    confusion_matrix: List[List[int]]
    class_labels: List[str]
    feature_importances: List[FeatureImportanceItem]
    is_demonstration_trained: bool
    trained_at: datetime


class TrainModelsRequest(BaseModel):
    dataset_id: Optional[int] = None
    test_size: float = Field(default=0.25, ge=0.15, le=0.4)
    random_state: int = Field(default=42)


class TrainModelsResponse(BaseModel):
    dataset_id: int
    dataset_name: str
    is_demonstration_trained: bool
    models: List[ModelEvaluationOut]


class LiveWeatherReading(BaseModel):
    state: str
    district: str
    latitude: float
    longitude: float
    current_rainfall_mm: float
    rainfall_24h_mm: float
    rainfall_7d_mm: float
    temperature_c: float
    humidity_pct: float
    soil_moisture_pct: Optional[float] = None
    soil_moisture_available: bool
    elevation_m: float
    slope_deg: float
    weather_summary: str
    source: str
    is_demo_fallback: bool
    observed_at: datetime


class InfluencingFactor(BaseModel):
    feature: str
    label: str
    value_display: str
    importance_pct: float
    impact_note: str


class RuleAdvisory(BaseModel):
    triggered: bool
    level: str  # NONE, WATCH, WARNING
    title: str
    reasons: List[str]
    notice: str


class PredictRequest(BaseModel):
    model_key: str = Field(default="random_forest")
    state: str
    district: str
    rainfall_mm: float = Field(..., ge=0.0, le=12000.0)
    temperature_c: Optional[float] = Field(default=22.0, ge=-30.0, le=55.0)
    humidity_pct: Optional[float] = Field(default=78.0, ge=0.0, le=100.0)
    elevation_m: float = Field(..., ge=0.0, le=9000.0)
    slope_deg: float = Field(..., ge=0.0, le=89.0)
    soil_moisture_pct: Optional[float] = Field(default=35.0, ge=0.0, le=100.0)
    ndvi: float = Field(default=0.45, ge=-1.0, le=1.0)
    distance_to_road_m: float = Field(default=250.0, ge=0.0, le=50000.0)
    weather_source: Optional[str] = Field(default="Manual Input")


class LivePredictRequest(BaseModel):
    model_key: str = Field(default="random_forest")
    state: str
    district: str
    force_refresh: bool = False


class PredictResponse(BaseModel):
    prediction_id: int
    model_key: str
    model_name: str
    state: str
    district: str
    predicted_class: str
    probabilities: Dict[str, float]
    rainfall_mm: Optional[float] = None
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    soil_moisture_pct: Optional[float] = None
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    weather_source: Optional[str] = None
    influencing_factors: List[InfluencingFactor] = Field(default_factory=list)
    rule_advisory: Optional[RuleAdvisory] = None
    is_demonstration_model: bool
    disclaimer: str
    created_at: datetime


class LivePredictResponse(BaseModel):
    prediction: PredictResponse
    weather: LiveWeatherReading


class AlertItem(BaseModel):
    id: str
    category: str  # ML_HIGH_RISK or RULE_THRESHOLD
    source_label: str
    state: str
    district: str
    risk_level: str
    message: str
    rainfall_mm: float
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    timestamp: datetime


class AlertsResponse(BaseModel):
    ml_high_risk_alerts: List[AlertItem]
    rule_based_advisories: List[AlertItem]
    weather_source: str
    is_demo_fallback: bool
    generated_at: datetime
