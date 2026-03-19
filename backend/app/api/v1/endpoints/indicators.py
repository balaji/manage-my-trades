"""
Indicator registry API endpoints.
"""

from fastapi import APIRouter

from app.services.indicator_registry import get_all_indicators

router = APIRouter()


@router.get(
    "/",
    summary="List available indicators",
    description="Returns the list of available technical indicators with their parameter definitions.",
)
async def list_indicators():
    return get_all_indicators()
