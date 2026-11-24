from typing import List, Optional
from fastapi import APIRouter, Query

from backend.schemas import LiveWeatherReading
from backend.services.weather_service import fetch_all_states_live_weather, fetch_live_weather

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/live", response_model=LiveWeatherReading)
async def get_live_weather(
    state: str = Query(default="Meghalaya"),
    district: Optional[str] = Query(default=None),
    refresh: bool = Query(default=False),
):
    data = await fetch_live_weather(state=state, district=district, force_refresh=refresh)
    return LiveWeatherReading(**data)


@router.get("/states", response_model=List[LiveWeatherReading])
async def get_all_states_live_weather(refresh: bool = Query(default=False)):
    items = await fetch_all_states_live_weather(force_refresh=refresh)
    return [LiveWeatherReading(**item) for item in items]
