from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class DatasetRecord(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    file_type = Column(String(40), nullable=False)  # csv, geojson, geotiff
    file_path = Column(String(500), nullable=False)
    row_count = Column(Integer, nullable=False, default=0)
    missing_values_imputed = Column(Integer, nullable=False, default=0)
    crs = Column(String(100), nullable=True)
    is_demonstration = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    summary_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    observations = relationship("ZoneObservation", back_populates="dataset", cascade="all, delete-orphan")
    model_runs = relationship("ModelEvaluationRun", back_populates="dataset", cascade="all, delete-orphan")


class ZoneObservation(Base):
    __tablename__ = "zone_observations"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(120), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    rainfall_mm = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=True, default=22.0)
    humidity_pct = Column(Float, nullable=True, default=78.0)
    elevation_m = Column(Float, nullable=False)
    slope_deg = Column(Float, nullable=False)
    soil_moisture_pct = Column(Float, nullable=False)
    ndvi = Column(Float, nullable=False)
    distance_to_road_m = Column(Float, nullable=False)
    susceptibility_class = Column(String(20), nullable=False, index=True)  # Low, Medium, High
    observed_date = Column(String(32), nullable=True)
    event_source = Column(String(250), nullable=True)
    is_demonstration = Column(Boolean, nullable=False, default=False)
    observed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    dataset = relationship("DatasetRecord", back_populates="observations")


class ModelEvaluationRun(Base):
    __tablename__ = "model_evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    model_key = Column(String(60), nullable=False, index=True)  # logistic_regression, decision_tree, random_forest
    model_name = Column(String(120), nullable=False)
    train_samples = Column(Integer, nullable=False)
    test_samples = Column(Integer, nullable=False)
    train_accuracy = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=False)
    precision_weighted = Column(Float, nullable=False)
    recall_weighted = Column(Float, nullable=False)
    f1_weighted = Column(Float, nullable=False)
    per_class_metrics_json = Column(Text, nullable=False)
    confusion_matrix_json = Column(Text, nullable=False)
    feature_importance_json = Column(Text, nullable=False)
    artifact_path = Column(String(500), nullable=False)
    is_demonstration_trained = Column(Boolean, nullable=False, default=False)
    trained_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    dataset = relationship("DatasetRecord", back_populates="model_runs")


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    model_run_id = Column(Integer, ForeignKey("model_evaluation_runs.id", ondelete="SET NULL"), nullable=True)
    model_key = Column(String(60), nullable=False)
    state = Column(String(100), nullable=False)
    district = Column(String(120), nullable=False)
    rainfall_mm = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=True)
    humidity_pct = Column(Float, nullable=True)
    elevation_m = Column(Float, nullable=False)
    slope_deg = Column(Float, nullable=False)
    soil_moisture_pct = Column(Float, nullable=True)
    ndvi = Column(Float, nullable=False)
    distance_to_road_m = Column(Float, nullable=False)
    predicted_class = Column(String(20), nullable=False)
    probabilities_json = Column(Text, nullable=False)
    weather_source = Column(String(160), nullable=True)
    influencing_factors_json = Column(Text, nullable=True)
    rule_advisory_json = Column(Text, nullable=True)
    is_demonstration_model = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
