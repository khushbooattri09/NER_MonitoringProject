import io
from pathlib import Path

import numpy as np
import rasterio
from fastapi.testclient import TestClient
from rasterio.transform import from_bounds

from backend.main import app


def test_health_and_overview():
    with TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        overview = client.get("/api/regions/overview")
        assert overview.status_code == 200
        data = overview.json()
        assert len(data["states"]) == 8
        assert data["total_observations"] >= 200
        assert set(data["class_distribution"].keys()) == {"Low", "Medium", "High"}
        assert isinstance(data["limitations"], list)


def test_geojson_and_environmental():
    with TestClient(app) as client:
        geo = client.get("/api/regions/geojson")
        assert geo.status_code == 200
        gj = geo.json()
        assert gj["type"] == "FeatureCollection"
        assert len(gj["features"]) == 8

        env = client.get("/api/regions/environmental?state=Sikkim")
        assert env.status_code == 200
        env_data = env.json()
        assert len(env_data["observations"]) > 0
        assert len(env_data["rainfall_bins"]) == 6
        assert len(env_data["elevation_bins"]) == 6
        assert len(env_data["slope_bins"]) == 6


def test_models_train_joblib_and_predict():
    with TestClient(app) as client:
        train_res = client.post("/api/models/train", json={"test_size": 0.25, "random_state": 42})
        assert train_res.status_code == 200
        models = train_res.json()["models"]
        assert len(models) == 3
        keys = {m["model_key"] for m in models}
        assert keys == {"logistic_regression", "decision_tree", "random_forest"}
        for m in models:
            assert m["train_accuracy"] is not None
            assert 0.0 <= m["train_accuracy"] <= 1.0
            assert 0.0 <= m["accuracy"] <= 1.0
            assert 0.0 <= m["precision_weighted"] <= 1.0
            assert 0.0 <= m["recall_weighted"] <= 1.0
            assert 0.0 <= m["f1_weighted"] <= 1.0
            assert len(m["confusion_matrix"]) == 3
            assert len(m["confusion_matrix"][0]) == 3

        pred = client.post(
            "/api/predictions/predict",
            json={
                "model_key": "random_forest",
                "state": "Meghalaya",
                "district": "East Khasi Hills",
                "rainfall_mm": 240.0,
                "temperature_c": 21.0,
                "humidity_pct": 88.0,
                "elevation_m": 1480,
                "slope_deg": 34.5,
                "soil_moisture_pct": 46.0,
                "ndvi": 0.35,
                "distance_to_road_m": 120.0,
            },
        )
        assert pred.status_code == 200
        pdata = pred.json()
        assert pdata["predicted_class"] in {"Low", "Medium", "High"}
        assert abs(sum(pdata["probabilities"].values()) - 1.0) < 0.02
        assert len(pdata["influencing_factors"]) >= 3
        assert pdata["rule_advisory"] is not None

        hist = client.get("/api/predictions/history")
        assert hist.status_code == 200
        assert len(hist.json()) >= 1


def test_live_weather_and_live_prediction():
    with TestClient(app) as client:
        w = client.get("/api/weather/live?state=Meghalaya&district=East%20Khasi%20Hills")
        assert w.status_code == 200
        wdata = w.json()
        assert wdata["state"] == "Meghalaya"
        assert wdata["district"] == "East Khasi Hills"
        assert "rainfall_7d_mm" in wdata
        assert "temperature_c" in wdata
        assert "humidity_pct" in wdata

        live_pred = client.post(
            "/api/predictions/predict-live",
            json={"model_key": "random_forest", "state": "Meghalaya", "district": "East Khasi Hills"},
        )
        assert live_pred.status_code == 200
        lp = live_pred.json()
        assert lp["prediction"]["predicted_class"] in {"Low", "Medium", "High"}
        assert lp["weather"]["state"] == "Meghalaya"

        alerts = client.get("/api/predictions/alerts")
        assert alerts.status_code == 200
        adata = alerts.json()
        assert "ml_high_risk_alerts" in adata
        assert "rule_based_advisories" in adata


def test_csv_and_geotiff_upload_then_reset(tmp_path: Path):
    with TestClient(app) as client:
        rows = ["state,district,latitude,longitude,rainfall_mm,temperature_c,humidity_pct,elevation_m,slope_deg,soil_moisture_pct,ndvi,distance_to_road_m,susceptibility_class"]
        for i in range(24):
            cls = "High" if i % 3 == 0 else ("Medium" if i % 3 == 1 else "Low")
            rain = 240 if cls == "High" else (95 if cls == "Medium" else 15)
            slope = 36 if cls == "High" else (22 if cls == "Medium" else 9)
            rows.append(f"Assam,Dima Hasao,25.17,93.02,{rain},24.5,84,950,{slope},44,0.42,210,{cls}")
        csv_bytes = "\n".join(rows).encode("utf-8")

        up_csv = client.post(
            "/api/datasets/upload",
            files={"file": ("field_survey.csv", io.BytesIO(csv_bytes), "text/csv")},
            data={"dataset_name": "Field Survey Test"},
        )
        assert up_csv.status_code == 200
        assert up_csv.json()["dataset"]["is_demonstration"] is False
        assert up_csv.json()["dataset"]["row_count"] == 24

        tif_path = tmp_path / "test_dem.tif"
        arr = np.linspace(150, 2600, 32 * 32, dtype=np.float32).reshape(32, 32)
        transform = from_bounds(91.0, 25.0, 93.0, 27.0, 32, 32)
        with rasterio.open(
            tif_path, "w", driver="GTiff", height=32, width=32, count=1,
            dtype="float32", crs="EPSG:4326", transform=transform
        ) as dst:
            dst.write(arr, 1)

        with open(tif_path, "rb") as tf:
            up_tif = client.post(
                "/api/datasets/upload",
                files={"file": ("test_dem.tif", tf, "image/tiff")},
                data={"dataset_name": "Test Rasterio DEM"},
            )
        assert up_tif.status_code == 200
        assert up_tif.json()["dataset"]["file_type"] == "geotiff"

        reset = client.post("/api/datasets/reset-demo")
        assert reset.status_code == 200
        assert reset.json()["is_demonstration"] is True
