import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from rasterio.transform import from_bounds
from shapely.geometry import Point, Polygon

from backend.config import DEMO_DIR, SUSCEPTIBILITY_CLASSES
from backend.services.ner_reference import NER_REFERENCE, STATE_BY_NAME

DEMO_GEOJSON_PATH = DEMO_DIR / "ner_states_demo.geojson"
DEMO_DEM_PATH = DEMO_DIR / "ner_dem_demo.tif"
DEMO_CSV_PATH = DEMO_DIR / "ner_landslide_demo.csv"

REQUIRED_NUMERIC_FEATURES = [
    "rainfall_mm",
    "elevation_m",
    "slope_deg",
    "soil_moisture_pct",
    "ndvi",
    "distance_to_road_m",
]


def _build_state_geodataframe() -> gpd.GeoDataFrame:
    rows = []
    for state_info in NER_REFERENCE:
        poly = Polygon(state_info["polygon"])
        rows.append(
            {
                "state": state_info["state"],
                "code": state_info["code"],
                "capital": state_info["capital"],
                "center_lat": state_info["center_lat"],
                "center_lon": state_info["center_lon"],
                "geometry": poly,
            }
        )
    gdf = gpd.GeoDataFrame(rows, crs="EPSG:4326")
    # Compute geodesic-approximated area in UTM Zone 46N (NE India)
    projected = gdf.to_crs("EPSG:32646")
    gdf["approx_area_km2"] = np.round(projected.geometry.area / 1_000_000.0, 2)
    return gdf


def _generate_demo_dem_geotiff(path: Path) -> None:
    """Create a synthetic GeoTIFF DEM covering NER (87.8E-97.6E, 21.8N-29.6N) for Rasterio processing."""
    width, height = 196, 156
    west, south, east, north = 87.8, 21.8, 97.6, 29.6
    transform = from_bounds(west, south, east, north, width, height)

    lons = np.linspace(west, east, width)
    lats = np.linspace(north, south, height)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    elevation = np.full((height, width), 85.0, dtype=np.float32)
    for state_info in NER_REFERENCE:
        for d in state_info["districts"]:
            dist2 = (lon_grid - d["lon"]) ** 2 + (lat_grid - d["lat"]) ** 2
            elevation += float(d["base_elev"]) * np.exp(-dist2 / 0.42)

    # Add deterministic micro-relief
    relief = 120.0 * np.sin(lon_grid * 4.5) * np.cos(lat_grid * 5.2)
    elevation = np.clip(elevation + relief, 30.0, 5200.0).astype(np.float32)

    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
        nodata=-9999.0,
    ) as dst:
        dst.write(elevation, 1)


def sample_dem_elevation_and_slope(
    dem_path: Path, points: List[Tuple[float, float]]
) -> List[Tuple[float, float]]:
    """Use Rasterio to sample elevation (m) and compute terrain slope (degrees) at (lon, lat) coordinates."""
    if not dem_path.exists():
        return [(800.0, 20.0) for _ in points]

    with rasterio.open(dem_path) as src:
        band = src.read(1).astype(np.float64)
        nodata = src.nodata
        if nodata is not None:
            valid_mask = band != nodata
            median_val = float(np.median(band[valid_mask])) if np.any(valid_mask) else 500.0
            band = np.where(valid_mask, band, median_val)

        # Approximate pixel spacing in meters (~111320 m/deg lat, cos(26deg)*111320 m/deg lon)
        dx_m = abs(src.transform.a) * 100000.0
        dy_m = abs(src.transform.e) * 111320.0
        dz_dy, dz_dx = np.gradient(band, dy_m, dx_m)
        slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
        slope_deg_grid = np.clip(np.degrees(slope_rad), 0.5, 65.0)

        results: List[Tuple[float, float]] = []
        for lon, lat in points:
            try:
                row, col = src.index(lon, lat)
                row = int(np.clip(row, 0, src.height - 1))
                col = int(np.clip(col, 0, src.width - 1))
                elev_val = float(band[row, col])
                # Scale synthetic coarse-grid slope to realistic hillslope angle range
                slope_val = float(np.clip(slope_deg_grid[row, col] * 14.0, 2.0, 58.0))
                results.append((round(elev_val, 2), round(slope_val, 2)))
            except Exception:
                results.append((800.0, 20.0))
        return results


def _generate_demo_csv(path: Path, dem_path: Path) -> pd.DataFrame:
    """Create a clearly marked synthetic demonstration CSV for NER pipeline verification."""
    rng = np.random.default_rng(26001)
    rows: List[Dict[str, Any]] = []

    for state_info in NER_REFERENCE:
        state_name = state_info["state"]
        for d in state_info["districts"]:
            # 8 spatially distributed monitoring points per district => 256 total points across 8 states
            for _ in range(8):
                lat = float(d["lat"] + rng.normal(0.0, 0.08))
                lon = float(d["lon"] + rng.normal(0.0, 0.08))

                dem_elev, dem_slope = sample_dem_elevation_and_slope(dem_path, [(lon, lat)])[0]
                elevation_m = float(np.clip(0.65 * d["base_elev"] + 0.35 * dem_elev + rng.normal(0, 110), 35, 4800))
                slope_deg = float(np.clip(0.70 * d["base_slope"] + 0.30 * dem_slope + rng.normal(0, 5.2), 2.5, 58.0))
                rainfall_mm = float(np.clip(d["base_rain"] + rng.normal(0, 420), 950, 6500))
                soil_moisture_pct = float(np.clip(18.0 + (rainfall_mm / 130.0) + rng.normal(0, 5.5), 10.0, 88.0))
                ndvi = float(np.clip(0.68 - (slope_deg / 140.0) + rng.normal(0, 0.09), 0.08, 0.92))
                distance_to_road_m = float(np.clip(rng.exponential(420.0) + 25.0, 15.0, 3500.0))

                # Transparent susceptibility hazard index for demonstration data generation
                hazard_score = (
                    0.34 * (slope_deg / 45.0)
                    + 0.32 * (rainfall_mm / 4200.0)
                    + 0.16 * (soil_moisture_pct / 70.0)
                    + 0.10 * (1.0 - ndvi)
                    + 0.08 * np.exp(-distance_to_road_m / 450.0)
                    + rng.normal(0, 0.055)
                )

                if hazard_score >= 0.62:
                    susceptibility = "High"
                elif hazard_score >= 0.43:
                    susceptibility = "Medium"
                else:
                    susceptibility = "Low"

                rows.append(
                    {
                        "state": state_name,
                        "district": d["name"],
                        "latitude": round(lat, 5),
                        "longitude": round(lon, 5),
                        "rainfall_mm": round(rainfall_mm, 1),
                        "elevation_m": round(elevation_m, 1),
                        "slope_deg": round(slope_deg, 1),
                        "soil_moisture_pct": round(soil_moisture_pct, 1),
                        "ndvi": round(ndvi, 3),
                        "distance_to_road_m": round(distance_to_road_m, 1),
                        "susceptibility_class": susceptibility,
                    }
                )

    df = pd.DataFrame(rows)
    df.to_csv(path, index=False)
    return df


def ensure_demonstration_assets() -> Tuple[Path, Path, Path]:
    if not DEMO_GEOJSON_PATH.exists():
        gdf = _build_state_geodataframe()
        gdf.to_file(DEMO_GEOJSON_PATH, driver="GeoJSON")
    if not DEMO_DEM_PATH.exists():
        _generate_demo_dem_geotiff(DEMO_DEM_PATH)
    if not DEMO_CSV_PATH.exists():
        _generate_demo_csv(DEMO_CSV_PATH, DEMO_DEM_PATH)
    return DEMO_GEOJSON_PATH, DEMO_DEM_PATH, DEMO_CSV_PATH


def _assign_state_via_geopandas(df: pd.DataFrame) -> pd.DataFrame:
    """Use GeoPandas spatial join to infer missing state names from (longitude, latitude)."""
    if "state" in df.columns:
        df["state"] = df["state"].replace(r"^\s*$", np.nan, regex=True)
        if df["state"].notna().all():
            return df

    states_gdf = gpd.read_file(DEMO_GEOJSON_PATH)[["state", "geometry"]]
    pts = [Point(float(lon), float(lat)) for lon, lat in zip(df["longitude"], df["latitude"])]
    pts_gdf = gpd.GeoDataFrame(df.copy(), geometry=pts, crs="EPSG:4326")
    joined = gpd.sjoin(pts_gdf, states_gdf, how="left", predicate="within", lsuffix="orig", rsuffix="poly")

    if "state_orig" in joined.columns and "state_poly" in joined.columns:
        joined["state"] = joined["state_orig"].fillna(joined["state_poly"])
        joined = joined.drop(columns=["state_orig", "state_poly"])
    elif "state" not in joined.columns and "state_poly" in joined.columns:
        joined["state"] = joined["state_poly"]

    if "index_right" in joined.columns:
        joined = joined.drop(columns=["index_right"])

    # Nearest fallback for points slightly outside simplified polygon borders
    missing_mask = joined["state"].isna()
    if missing_mask.any():
        for idx in joined[missing_mask].index:
            lat, lon = float(joined.at[idx, "latitude"]), float(joined.at[idx, "longitude"])
            nearest = min(
                NER_REFERENCE,
                key=lambda s: (s["center_lat"] - lat) ** 2 + (s["center_lon"] - lon) ** 2,
            )
            joined.at[idx, "state"] = nearest["state"]

    return pd.DataFrame(joined.drop(columns=["geometry"]))


def _normalize_susceptibility_column(df: pd.DataFrame) -> pd.DataFrame:
    if "susceptibility_class" not in df.columns:
        # Derive label transparently from physical terrain thresholds if target column was omitted in raw upload
        score = (
            0.38 * (df["slope_deg"] / 45.0)
            + 0.35 * (df["rainfall_mm"] / 4000.0)
            + 0.17 * (df["soil_moisture_pct"] / 70.0)
            + 0.10 * (1.0 - df["ndvi"])
        )
        df["susceptibility_class"] = np.where(
            score >= 0.62, "High", np.where(score >= 0.43, "Medium", "Low")
        )
    else:
        df["susceptibility_class"] = (
            df["susceptibility_class"]
            .astype(str)
            .str.strip()
            .str.title()
            .replace({"Moderate": "Medium", "1": "Low", "2": "Medium", "3": "High"})
        )
        df.loc[~df["susceptibility_class"].isin(SUSCEPTIBILITY_CLASSES), "susceptibility_class"] = "Medium"
    return df


def preprocess_csv_dataset(file_path: Path) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    raw_df = pd.read_csv(file_path)
    raw_df.columns = [c.strip().lower().replace(" ", "_") for c in raw_df.columns]

    column_aliases = {
        "lat": "latitude",
        "lon": "longitude",
        "lng": "longitude",
        "rainfall": "rainfall_mm",
        "elevation": "elevation_m",
        "slope": "slope_deg",
        "soil_moisture": "soil_moisture_pct",
        "risk_class": "susceptibility_class",
        "risk": "susceptibility_class",
        "label": "susceptibility_class",
    }
    raw_df = raw_df.rename(columns={k: v for k, v in column_aliases.items() if k in raw_df.columns})

    if "latitude" not in raw_df.columns or "longitude" not in raw_df.columns:
        # Assign representative NER coordinates if spatial columns absent
        raw_df["latitude"] = raw_df.get("state", pd.Series(["Assam"] * len(raw_df))).map(
            lambda s: STATE_BY_NAME.get(str(s), NER_REFERENCE[0])["center_lat"]
        )
        raw_df["longitude"] = raw_df.get("state", pd.Series(["Assam"] * len(raw_df))).map(
            lambda s: STATE_BY_NAME.get(str(s), NER_REFERENCE[0])["center_lon"]
        )

    raw_df = _assign_state_via_geopandas(raw_df)

    if "district" not in raw_df.columns:
        raw_df["district"] = raw_df["state"].map(
            lambda s: STATE_BY_NAME.get(str(s), NER_REFERENCE[0])["districts"][0]["name"]
        )
    else:
        raw_df["district"] = raw_df["district"].fillna("Unspecified District").astype(str)

    # Sample elevation/slope from Rasterio DEM if missing
    if "elevation_m" not in raw_df.columns or "slope_deg" not in raw_df.columns:
        pts = list(zip(raw_df["longitude"].astype(float), raw_df["latitude"].astype(float)))
        sampled = sample_dem_elevation_and_slope(DEMO_DEM_PATH, pts)
        if "elevation_m" not in raw_df.columns:
            raw_df["elevation_m"] = [s[0] for s in sampled]
        if "slope_deg" not in raw_df.columns:
            raw_df["slope_deg"] = [s[1] for s in sampled]

    defaults = {
        "rainfall_mm": 120.0,
        "temperature_c": 22.0,
        "humidity_pct": 78.0,
        "soil_moisture_pct": 38.0,
        "ndvi": 0.48,
        "distance_to_road_m": 320.0,
    }
    for col, val in defaults.items():
        if col not in raw_df.columns:
            raw_df[col] = val

    if "observed_date" not in raw_df.columns:
        raw_df["observed_date"] = None
    if "event_source" not in raw_df.columns:
        raw_df["event_source"] = None

    missing_count = 0
    numeric_cols = REQUIRED_NUMERIC_FEATURES + ["temperature_c", "humidity_pct", "latitude", "longitude"]
    for col in numeric_cols:
        raw_df[col] = pd.to_numeric(raw_df[col], errors="coerce")
        col_missing = int(raw_df[col].isna().sum())
        if col_missing > 0:
            missing_count += col_missing
            median_val = float(raw_df[col].median()) if not raw_df[col].dropna().empty else defaults.get(col, 0.0)
            raw_df[col] = raw_df[col].fillna(median_val)

    raw_df = _normalize_susceptibility_column(raw_df)

    report = {
        "processor": "Pandas + GeoPandas (EPSG:4326 -> EPSG:32646)",
        "rows_ingested": int(len(raw_df)),
        "missing_values_imputed": int(missing_count),
        "crs": "EPSG:4326",
        "columns_detected": list(raw_df.columns),
    }
    return raw_df, report


def preprocess_geojson_dataset(file_path: Path) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    gdf = gpd.read_file(file_path)
    original_crs = str(gdf.crs) if gdf.crs else "EPSG:4326"
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif str(gdf.crs) != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")

    # Compute accurate centroids in projected UTM 46N before converting back to lon/lat
    projected_centroids = gdf.to_crs("EPSG:32646").geometry.centroid
    centroids_4326 = gpd.GeoSeries(projected_centroids, crs="EPSG:32646").to_crs("EPSG:4326")

    df = pd.DataFrame(gdf.drop(columns=["geometry"]))
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    df["longitude"] = centroids_4326.x.values
    df["latitude"] = centroids_4326.y.values

    # Persist temporary normalized CSV to reuse tabular preprocessing + Rasterio DEM enrichment
    temp_csv = file_path.with_suffix(".normalized.csv")
    df.to_csv(temp_csv, index=False)
    processed_df, report = preprocess_csv_dataset(temp_csv)
    temp_csv.unlink(missing_ok=True)

    report["processor"] = "GeoPandas + Shapely + Rasterio DEM Enrichment"
    report["original_crs"] = original_crs
    report["reprojected_crs"] = "EPSG:4326"
    return processed_df, report


def preprocess_geotiff_dataset(file_path: Path) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Process an uploaded GeoTIFF DEM with Rasterio: inspect CRS, compute slope gradient, extract zonal samples."""
    with rasterio.open(file_path) as src:
        crs_str = str(src.crs) if src.crs else "EPSG:4326"
        bounds = src.bounds
        width, height = src.width, src.height
        band = src.read(1).astype(np.float64)
        nodata = src.nodata
        valid = band[band != nodata] if nodata is not None else band.ravel()
        elev_min = float(np.min(valid)) if valid.size else 0.0
        elev_max = float(np.max(valid)) if valid.size else 0.0
        elev_mean = float(np.mean(valid)) if valid.size else 0.0

    # Sample up to 64 evenly distributed coordinates within raster bounds
    xs = np.linspace(bounds.left, bounds.right, 8)
    ys = np.linspace(bounds.bottom, bounds.top, 8)
    native_pts = [(float(x), float(y)) for y in ys for x in xs]
    sampled = sample_dem_elevation_and_slope(file_path, native_pts)

    if crs_str != "EPSG:4326":
        transformer = Transformer.from_crs(crs_str, "EPSG:4326", always_xy=True)
        lonlat_pts = [transformer.transform(x, y) for x, y in native_pts]
    else:
        lonlat_pts = native_pts

    rng = np.random.default_rng(42)
    rows = []
    for (lon, lat), (elev, slope) in zip(lonlat_pts, sampled):
        # Assign rainfall/soil moisture heuristically for extracted DEM cells if no tabular weather file provided
        rainfall_mm = float(np.clip(2200 + (elev * 0.25) + rng.normal(0, 260), 1000, 5500))
        soil_moisture = float(np.clip(24 + rainfall_mm / 140.0 + rng.normal(0, 4), 12, 85))
        ndvi = float(np.clip(0.65 - slope / 130.0 + rng.normal(0, 0.07), 0.1, 0.9))
        dist_road = float(np.clip(rng.exponential(400) + 30, 20, 3000))
        rows.append(
            {
                "latitude": round(lat, 5),
                "longitude": round(lon, 5),
                "elevation_m": elev,
                "slope_deg": slope,
                "rainfall_mm": round(rainfall_mm, 1),
                "soil_moisture_pct": round(soil_moisture, 1),
                "ndvi": round(ndvi, 3),
                "distance_to_road_m": round(dist_road, 1),
            }
        )

    df = pd.DataFrame(rows)
    df = _assign_state_via_geopandas(df)
    df["district"] = df["state"].map(
        lambda s: STATE_BY_NAME.get(str(s), NER_REFERENCE[0])["districts"][0]["name"]
    )
    df = _normalize_susceptibility_column(df)

    report = {
        "processor": "Rasterio GeoTIFF DEM + GeoPandas Spatial Join",
        "crs": crs_str,
        "raster_dimensions": f"{width}x{height}",
        "bounds": [round(bounds.left, 4), round(bounds.bottom, 4), round(bounds.right, 4), round(bounds.top, 4)],
        "elevation_stats_m": {"min": round(elev_min, 1), "max": round(elev_max, 1), "mean": round(elev_mean, 1)},
        "rows_ingested": int(len(df)),
        "missing_values_imputed": 0,
    }
    return df, report


def build_state_geojson_with_stats(observations: List[Any], is_demonstration: bool) -> Dict[str, Any]:
    """Enrich GeoPandas NER state polygons with aggregated landslide observation statistics."""
    ensure_demonstration_assets()
    gdf = gpd.read_file(DEMO_GEOJSON_PATH)

    obs_by_state: Dict[str, List[Any]] = {}
    for obs in observations:
        obs_by_state.setdefault(obs.state, []).append(obs)

    enriched_rows = []
    for _, row in gdf.iterrows():
        st = row["state"]
        items = obs_by_state.get(st, [])
        count = len(items)
        if count > 0:
            mean_rain = round(sum(i.rainfall_mm for i in items) / count, 1)
            mean_elev = round(sum(i.elevation_m for i in items) / count, 1)
            mean_slope = round(sum(i.slope_deg for i in items) / count, 1)
            high_cnt = sum(1 for i in items if i.susceptibility_class == "High")
            med_cnt = sum(1 for i in items if i.susceptibility_class == "Medium")
            low_cnt = sum(1 for i in items if i.susceptibility_class == "Low")
            high_pct = round((high_cnt / count) * 100.0, 1)
            if high_cnt >= med_cnt and high_cnt >= low_cnt:
                dom = "High"
            elif med_cnt >= low_cnt:
                dom = "Medium"
            else:
                dom = "Low"
        else:
            mean_rain, mean_elev, mean_slope, high_pct, dom = 0.0, 0.0, 0.0, 0.0, "Low"

        enriched_rows.append(
            {
                **row.to_dict(),
                "observation_count": count,
                "mean_rainfall_mm": mean_rain,
                "mean_elevation_m": mean_elev,
                "mean_slope_deg": mean_slope,
                "high_risk_share_pct": high_pct,
                "dominant_susceptibility": dom,
                "is_demonstration": is_demonstration,
            }
        )

    enriched_gdf = gpd.GeoDataFrame(enriched_rows, crs="EPSG:4326")
    return json.loads(enriched_gdf.to_json())
