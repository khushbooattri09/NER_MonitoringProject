from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.services.geospatial import DEMO_DEM_PATH, sample_dem_elevation_and_slope
from backend.services.ner_reference import NER_REFERENCE, STATE_BY_NAME

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 180

# In-memory TTL cache keyed by (state, district)
_WEATHER_CACHE: Dict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = {}

WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
}


def resolve_district_coords(state: str, district: Optional[str] = None) -> Dict[str, Any]:
    state_info = STATE_BY_NAME.get(state) or NER_REFERENCE[0]
    districts = state_info["districts"]
    selected = None
    if district and district != "All":
        for d in districts:
            if d["name"].lower() == district.lower():
                selected = d
                break
    if selected is None:
        selected = districts[0]

    _, dem_slope = sample_dem_elevation_and_slope(
        DEMO_DEM_PATH, [(selected["lon"], selected["lat"])]
    )[0]
    slope_deg = round(float(0.65 * selected["base_slope"] + 0.35 * dem_slope), 1)

    return {
        "state": state_info["state"],
        "district": selected["name"],
        "lat": selected["lat"],
        "lon": selected["lon"],
        "base_elev": selected["base_elev"],
        "slope_deg": slope_deg,
        "base_rain": selected["base_rain"],
    }


def _demo_weather_fallback(loc: Dict[str, Any], reason: str) -> Dict[str, Any]:
    """Clearly labeled Demo Mode fallback when external Open-Meteo API is unreachable.

    Note: Soil moisture is explicitly marked unavailable rather than inventing sensor readings.
    """
    return {
        "state": loc["state"],
        "district": loc["district"],
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "current_rainfall_mm": 4.2,
        "rainfall_24h_mm": 18.5,
        "rainfall_7d_mm": round(float(loc["base_rain"]) / 30.0, 1),
        "temperature_c": round(max(8.0, 26.5 - (loc["base_elev"] / 250.0)), 1),
        "humidity_pct": 81.0,
        "soil_moisture_pct": None,
        "soil_moisture_available": False,
        "elevation_m": float(loc["base_elev"]),
        "slope_deg": float(loc["slope_deg"]),
        "weather_summary": f"Demo fallback ({reason})",
        "source": "Demo Mode (External Weather API Unavailable)",
        "is_demo_fallback": True,
        "observed_at": datetime.now(timezone.utc),
    }


async def fetch_live_weather(
    state: str,
    district: Optional[str] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    loc = resolve_district_coords(state, district)
    cache_key = (loc["state"], loc["district"])

    if not force_refresh and cache_key in _WEATHER_CACHE:
        cached_at, cached_payload = _WEATHER_CACHE[cache_key]
        if (time.monotonic() - cached_at) < CACHE_TTL_SECONDS:
            return cached_payload

    params = {
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "current": "temperature_2m,relative_humidity_2m,rain,precipitation,weather_code",
        "hourly": "soil_moisture_0_to_7cm",
        "daily": "precipitation_sum",
        "past_days": 7,
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(OPEN_METEO_FORECAST_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        current = data.get("current", {})
        daily = data.get("daily", {})
        hourly = data.get("hourly", {})

        precip_list = [
            float(v) for v in (daily.get("precipitation_sum") or []) if v is not None
        ]
        rain_7d = round(sum(precip_list), 1) if precip_list else 0.0
        rain_24h = round(precip_list[-1], 1) if precip_list else float(current.get("precipitation") or 0.0)
        current_rain = round(float(current.get("rain") or current.get("precipitation") or 0.0), 1)

        temp_c = round(float(current.get("temperature_2m", 22.0)), 1)
        humidity_pct = round(float(current.get("relative_humidity_2m", 75.0)), 1)
        wmo_code = int(current.get("weather_code", 0) or 0)
        weather_desc = WMO_CODES.get(wmo_code, "Monitored atmospheric conditions")

        # Extract nearest valid hourly soil moisture; explicitly None if unavailable
        soil_vals = [v for v in (hourly.get("soil_moisture_0_to_7cm") or []) if v is not None]
        if soil_vals:
            # Convert volumetric m³/m³ (0..1) into percentage (0..100%)
            soil_pct: Optional[float] = round(float(soil_vals[-1]) * 100.0, 1)
            soil_available = True
        else:
            soil_pct = None
            soil_available = False

        elev_m = round(float(data.get("elevation") or loc["base_elev"]), 1)

        result = {
            "state": loc["state"],
            "district": loc["district"],
            "latitude": loc["lat"],
            "longitude": loc["lon"],
            "current_rainfall_mm": current_rain,
            "rainfall_24h_mm": rain_24h,
            "rainfall_7d_mm": rain_7d,
            "temperature_c": temp_c,
            "humidity_pct": humidity_pct,
            "soil_moisture_pct": soil_pct,
            "soil_moisture_available": soil_available,
            "elevation_m": elev_m,
            "slope_deg": float(loc["slope_deg"]),
            "weather_summary": weather_desc,
            "source": "Open-Meteo Live Weather API",
            "is_demo_fallback": False,
            "observed_at": datetime.now(timezone.utc),
        }
        _WEATHER_CACHE[cache_key] = (time.monotonic(), result)
        return result
    except Exception as exc:
        return _demo_weather_fallback(loc, reason=type(exc).__name__)


async def fetch_all_states_live_weather(force_refresh: bool = False) -> List[Dict[str, Any]]:
    tasks = [
        fetch_live_weather(s["state"], s["districts"][0]["name"], force_refresh=force_refresh)
        for s in NER_REFERENCE
    ]
    return await asyncio.gather(*tasks)
