import json
import pickle
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from backend.config import ARTIFACTS_DIR, SUSCEPTIBILITY_CLASSES

FEATURE_COLUMNS = [
    "rainfall_mm",
    "temperature_c",
    "humidity_pct",
    "soil_moisture_pct",
    "elevation_m",
    "slope_deg",
]

FEATURE_LABELS = {
    "rainfall_mm": ("7-Day / Event Rainfall", "mm"),
    "temperature_c": ("Ambient Temperature", "°C"),
    "humidity_pct": ("Relative Humidity", "%"),
    "soil_moisture_pct": ("Soil Moisture", "%"),
    "elevation_m": ("Elevation", "m"),
    "slope_deg": ("Terrain Slope", "°"),
}

MODEL_SPECS = [
    ("logistic_regression", "Logistic Regression"),
    ("decision_tree", "Decision Tree Classifier"),
    ("random_forest", "Random Forest Classifier"),
]


def _build_estimator(model_key: str, random_state: int) -> Pipeline:
    if model_key == "logistic_regression":
        clf = LogisticRegression(max_iter=1500, random_state=random_state)
        return Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("classifier", clf),
        ])
    elif model_key == "decision_tree":
        clf = DecisionTreeClassifier(max_depth=6, min_samples_leaf=4, random_state=random_state)
        return Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("classifier", clf),
        ])
    elif model_key == "random_forest":
        clf = RandomForestClassifier(
            n_estimators=150,
            max_depth=8,
            min_samples_leaf=3,
            random_state=random_state,
            n_jobs=1,
        )
        return Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("classifier", clf),
        ])
    raise ValueError(f"Unsupported model key: {model_key}")


def _extract_feature_importances(pipeline: Pipeline, model_key: str) -> List[Dict[str, Any]]:
    clf = pipeline.named_steps["classifier"]
    if model_key == "logistic_regression" and hasattr(clf, "coef_"):
        raw = np.mean(np.abs(clf.coef_), axis=0)
    elif hasattr(clf, "feature_importances_"):
        raw = np.asarray(clf.feature_importances_, dtype=float)
    else:
        raw = np.ones(len(FEATURE_COLUMNS), dtype=float)

    total = float(np.sum(raw))
    if total > 0:
        norm = raw / total
    else:
        norm = np.ones(len(FEATURE_COLUMNS), dtype=float) / len(FEATURE_COLUMNS)

    items = [
        {"feature": col, "importance": round(float(val), 4)}
        for col, val in zip(FEATURE_COLUMNS, norm)
    ]
    items.sort(key=lambda x: x["importance"], reverse=True)
    return items


def _load_pipeline(artifact_path: str) -> Pipeline:
    path = Path(artifact_path)
    if not path.exists():
        raise FileNotFoundError("Trained model artifact not found. Please run model training first.")
    if path.suffix == ".joblib":
        return joblib.load(path)
    try:
        return joblib.load(path)
    except Exception:
        with open(path, "rb") as f:
            return pickle.load(f)


def train_and_evaluate_models(
    observations: List[Any],
    dataset_id: int,
    test_size: float = 0.25,
    random_state: int = 42,
) -> List[Dict[str, Any]]:
    if len(observations) < 15:
        raise ValueError("At least 15 observations are required to train and evaluate ML models.")

    df = pd.DataFrame(
        [
            {
                "rainfall_mm": getattr(obs, "rainfall_mm", np.nan),
                "temperature_c": getattr(obs, "temperature_c", np.nan),
                "humidity_pct": getattr(obs, "humidity_pct", np.nan),
                "soil_moisture_pct": getattr(obs, "soil_moisture_pct", np.nan),
                "elevation_m": getattr(obs, "elevation_m", np.nan),
                "slope_deg": getattr(obs, "slope_deg", np.nan),
                "susceptibility_class": obs.susceptibility_class,
            }
            for obs in observations
        ]
    )

    X = df[FEATURE_COLUMNS]
    y = df["susceptibility_class"]

    class_counts = y.value_counts()
    can_stratify = len(class_counts) >= 2 and (class_counts >= 2).all()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y if can_stratify else None,
    )

    results: List[Dict[str, Any]] = []
    for model_key, model_name in MODEL_SPECS:
        pipeline = _build_estimator(model_key, random_state=random_state)
        pipeline.fit(X_train, y_train)

        y_train_pred = pipeline.predict(X_train)
        train_acc = float(accuracy_score(y_train, y_train_pred))

        y_pred = pipeline.predict(X_test)
        acc = float(accuracy_score(y_test, y_pred))
        prec_w = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec_w = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1_w = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

        p_arr, r_arr, f_arr, s_arr = precision_recall_fscore_support(
            y_test,
            y_pred,
            labels=SUSCEPTIBILITY_CLASSES,
            zero_division=0,
        )
        per_class = [
            {
                "label": lbl,
                "precision": round(float(p), 4),
                "recall": round(float(r), 4),
                "f1_score": round(float(f), 4),
                "support": int(s),
            }
            for lbl, p, r, f, s in zip(SUSCEPTIBILITY_CLASSES, p_arr, r_arr, f_arr, s_arr)
        ]

        cm = confusion_matrix(y_test, y_pred, labels=SUSCEPTIBILITY_CLASSES).tolist()
        importances = _extract_feature_importances(pipeline, model_key)

        artifact_path = ARTIFACTS_DIR / f"dataset_{dataset_id}_{model_key}.joblib"
        joblib.dump(pipeline, artifact_path)

        results.append(
            {
                "model_key": model_key,
                "model_name": model_name,
                "train_samples": int(len(X_train)),
                "test_samples": int(len(X_test)),
                "train_accuracy": round(train_acc, 4),
                "accuracy": round(acc, 4),
                "precision_weighted": round(prec_w, 4),
                "recall_weighted": round(rec_w, 4),
                "f1_weighted": round(f1_w, 4),
                "per_class_metrics": per_class,
                "confusion_matrix": cm,
                "feature_importances": importances,
                "artifact_path": str(artifact_path),
            }
        )

    return results


def predict_susceptibility(
    artifact_path: str,
    payload: Dict[str, Optional[float]],
    model_key: str = "random_forest",
) -> Tuple[str, Dict[str, float], List[Dict[str, Any]]]:
    pipeline = _load_pipeline(artifact_path)

    row = {col: (np.nan if payload.get(col) is None else float(payload[col])) for col in FEATURE_COLUMNS}
    input_df = pd.DataFrame([row])

    predicted_class = str(pipeline.predict(input_df)[0])

    probabilities: Dict[str, float] = {cls: 0.0 for cls in SUSCEPTIBILITY_CLASSES}
    if hasattr(pipeline, "predict_proba"):
        probs = pipeline.predict_proba(input_df)[0]
        classes = [str(c) for c in pipeline.classes_]
        for cls, prob in zip(classes, probs):
            probabilities[cls] = round(float(prob), 4)
    else:
        probabilities[predicted_class] = 1.0

    # Compute main factors influencing this prediction from trained feature importances + imputer medians
    importances = _extract_feature_importances(pipeline, model_key)
    imputer: Optional[SimpleImputer] = pipeline.named_steps.get("imputer")
    medians = (
        dict(zip(FEATURE_COLUMNS, imputer.statistics_))
        if imputer is not None and hasattr(imputer, "statistics_")
        else {}
    )

    factors: List[Dict[str, Any]] = []
    for item in importances[:4]:
        feat = item["feature"]
        label, unit = FEATURE_LABELS.get(feat, (feat, ""))
        raw_val = payload.get(feat)
        med = medians.get(feat)

        if raw_val is None:
            val_display = f"Unavailable (imputed median {round(float(med), 1)} {unit})" if med is not None else "Unavailable"
            impact_note = "Live sensor unavailable; trained pipeline median used for inference"
        else:
            val_num = float(raw_val)
            val_display = f"{round(val_num, 1)} {unit}".strip()
            if med is not None:
                diff = val_num - float(med)
                if feat == "rainfall_mm" and val_num >= 120:
                    impact_note = "Heavy cumulative rainfall increases pore-water pressure"
                elif feat == "slope_deg" and val_num >= 28:
                    impact_note = "Steep terrain gradient elevates shear stress"
                elif feat == "soil_moisture_pct" and val_num >= 40:
                    impact_note = "High soil saturation reduces slope cohesion"
                elif abs(diff) <= 0.1 * max(1.0, abs(float(med))):
                    impact_note = "Near historical regional median"
                elif diff > 0:
                    impact_note = f"Above dataset median ({round(float(med), 1)} {unit})"
                else:
                    impact_note = f"Below dataset median ({round(float(med), 1)} {unit})"
            else:
                impact_note = "Model feature weight"

        factors.append(
            {
                "feature": feat,
                "label": label,
                "value_display": val_display,
                "importance_pct": round(item["importance"] * 100.0, 1),
                "impact_note": impact_note,
            }
        )

    return predicted_class, probabilities, factors


def evaluate_rule_based_advisory(
    rainfall_7d_mm: float,
    rainfall_24h_mm: Optional[float],
    slope_deg: float,
    soil_moisture_pct: Optional[float],
) -> Dict[str, Any]:
    """Separate rule-based physical threshold advisory (distinct from ML classification)."""
    reasons: List[str] = []

    if rainfall_24h_mm is not None and rainfall_24h_mm >= 64.5:
        reasons.append(f"24h rainfall ({rainfall_24h_mm:.1f} mm) exceeds IMD Heavy Rain threshold (64.5 mm).")
    if rainfall_7d_mm >= 180.0:
        reasons.append(f"7-day cumulative rainfall ({rainfall_7d_mm:.1f} mm) indicates prolonged monsoon saturation.")
    elif rainfall_7d_mm >= 90.0 and slope_deg >= 25.0:
        reasons.append(f"Moderate-high rainfall ({rainfall_7d_mm:.1f} mm) combined with steep slope ({slope_deg:.1f}°).")

    if soil_moisture_pct is not None and soil_moisture_pct >= 42.0 and slope_deg >= 25.0:
        reasons.append(f"Elevated soil moisture ({soil_moisture_pct:.1f}%) on steep terrain ({slope_deg:.1f}°).")

    if len(reasons) >= 2 or (rainfall_24h_mm is not None and rainfall_24h_mm >= 115.5):
        level = "WARNING"
        title = "Rule-Based Threshold Advisory: Elevated Terrain Stress"
    elif len(reasons) == 1:
        level = "WATCH"
        title = "Rule-Based Threshold Watch: Monitor Rainfall & Slope"
    else:
        level = "NONE"
        title = "No Rule-Based Weather Threshold Breached"
        reasons.append("Current rainfall and soil conditions are below standard physical threshold triggers.")

    return {
        "triggered": level != "NONE",
        "level": level,
        "title": title,
        "reasons": reasons,
        "notice": "Rule-based threshold check (IMD/terrain heuristics) — reported separately from the Joblib Random Forest ML model.",
    }
