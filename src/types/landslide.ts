export type SusceptibilityClass = 'Low' | 'Medium' | 'High';

export function formatRiskLabel(cls: SusceptibilityClass | string): 'LOW' | 'MODERATE' | 'HIGH' {
  if (cls === 'High' || cls === 'HIGH') return 'HIGH';
  if (cls === 'Medium' || cls === 'Moderate' || cls === 'MODERATE') return 'MODERATE';
  return 'LOW';
}

export interface StateMetadata {
  state: string;
  code: string;
  capital: string;
  center_lat: number;
  center_lon: number;
  districts: string[];
}

export interface DistrictSummary {
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  observation_count: number;
  mean_rainfall_mm: number;
  mean_elevation_m: number;
  mean_slope_deg: number;
  dominant_susceptibility: SusceptibilityClass;
  high_risk_share_pct: number;
  is_demonstration: boolean;
}

export interface RegionOverviewResponse {
  active_dataset_id: number | null;
  active_dataset_name: string;
  is_demonstration: boolean;
  provenance_notice: string;
  total_observations: number;
  class_distribution: Record<SusceptibilityClass, number>;
  states: StateMetadata[];
  district_summaries: DistrictSummary[];
  limitations: string[];
  missing_values_imputed: number;
  latest_data_update: string | null;
}

export interface ObservationItem {
  id: number;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  rainfall_mm: number;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  elevation_m: number;
  slope_deg: number;
  soil_moisture_pct: number;
  ndvi: number;
  distance_to_road_m: number;
  susceptibility_class: SusceptibilityClass;
  observed_date?: string | null;
  event_source?: string | null;
  is_demonstration: boolean;
}

export interface HistogramBin {
  range: string;
  Low: number;
  Medium: number;
  High: number;
  total: number;
}

export interface StateAggregate {
  state: string;
  mean_rainfall_mm: number;
  mean_elevation_m: number;
  mean_slope_deg: number;
  high_risk_count: number;
  total: number;
}

export interface HistoricalTrendPoint {
  period: string;
  mean_rainfall_mm: number;
  mean_soil_moisture_pct: number;
  mean_humidity_pct: number;
  high_risk_events: number;
  medium_risk_events: number;
  low_risk_events: number;
  total_records: number;
}

export interface EnvironmentalProfilesResponse {
  is_demonstration: boolean;
  state_filter: string | null;
  district_filter: string | null;
  observations: ObservationItem[];
  rainfall_bins: HistogramBin[];
  elevation_bins: HistogramBin[];
  slope_bins: HistogramBin[];
  state_aggregates: StateAggregate[];
  historical_trends: HistoricalTrendPoint[];
}

export interface DatasetSummary {
  id: number;
  name: string;
  file_type: string;
  row_count: number;
  missing_values_imputed: number;
  crs: string | null;
  is_demonstration: boolean;
  is_active: boolean;
  summary: Record<string, unknown>;
  created_at: string;
}

export interface DatasetUploadResponse {
  dataset: DatasetSummary;
  preprocessing_report: Record<string, unknown>;
  message: string;
}

export interface PerClassMetric {
  label: SusceptibilityClass;
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface ModelEvaluation {
  id: number;
  dataset_id: number;
  model_key: 'logistic_regression' | 'decision_tree' | 'random_forest';
  model_name: string;
  train_samples: number;
  test_samples: number;
  train_accuracy?: number | null;
  accuracy: number;
  precision_weighted: number;
  recall_weighted: number;
  f1_weighted: number;
  per_class_metrics: PerClassMetric[];
  confusion_matrix: number[][];
  class_labels: SusceptibilityClass[];
  feature_importances: FeatureImportanceItem[];
  is_demonstration_trained: boolean;
  trained_at: string;
}

export interface LiveWeatherReading {
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  current_rainfall_mm: number;
  rainfall_24h_mm: number;
  rainfall_7d_mm: number;
  temperature_c: number;
  humidity_pct: number;
  soil_moisture_pct: number | null;
  soil_moisture_available: boolean;
  elevation_m: number;
  slope_deg: number;
  weather_summary: string;
  source: string;
  is_demo_fallback: boolean;
  observed_at: string;
}

export interface InfluencingFactor {
  feature: string;
  label: string;
  value_display: string;
  importance_pct: number;
  impact_note: string;
}

export interface RuleAdvisory {
  triggered: boolean;
  level: 'NONE' | 'WATCH' | 'WARNING' | string;
  title: string;
  reasons: string[];
  notice: string;
}

export interface PredictRequest {
  model_key: string;
  state: string;
  district: string;
  rainfall_mm: number;
  temperature_c?: number;
  humidity_pct?: number;
  elevation_m: number;
  slope_deg: number;
  soil_moisture_pct: number | null;
  ndvi: number;
  distance_to_road_m: number;
  weather_source?: string;
}

export interface PredictResponse {
  prediction_id: number;
  model_key: string;
  model_name: string;
  state: string;
  district: string;
  predicted_class: SusceptibilityClass;
  probabilities: Record<SusceptibilityClass, number>;
  rainfall_mm?: number | null;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  soil_moisture_pct?: number | null;
  elevation_m?: number | null;
  slope_deg?: number | null;
  weather_source?: string | null;
  influencing_factors: InfluencingFactor[];
  rule_advisory?: RuleAdvisory | null;
  is_demonstration_model: boolean;
  disclaimer: string;
  created_at: string;
}

export interface LivePredictResponse {
  prediction: PredictResponse;
  weather: LiveWeatherReading;
}

export interface AlertItem {
  id: string;
  category: 'ML_HIGH_RISK' | 'RULE_THRESHOLD' | string;
  source_label: string;
  state: string;
  district: string;
  risk_level: string;
  message: string;
  rainfall_mm: number;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  timestamp: string;
}

export interface AlertsResponse {
  ml_high_risk_alerts: AlertItem[];
  rule_based_advisories: AlertItem[];
  weather_source: string;
  is_demo_fallback: boolean;
  generated_at: string;
}

export interface NerGeoJsonFeature {
  type: 'Feature';
  properties: {
    state: string;
    code: string;
    capital: string;
    center_lat: number;
    center_lon: number;
    approx_area_km2: number;
    observation_count: number;
    mean_rainfall_mm: number;
    mean_elevation_m: number;
    mean_slope_deg: number;
    high_risk_share_pct: number;
    dominant_susceptibility: SusceptibilityClass;
    is_demonstration: boolean;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

export interface NerGeoJsonCollection {
  type: 'FeatureCollection';
  features: NerGeoJsonFeature[];
}
