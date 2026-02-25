import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import CachedData, Instance, User, UserSettings
from app.schemas import AlertEntry, AlertInstanceSummary, AlertPageData
from app.services.aggregator import COMPOSITE_ALERT_TYPES, _build_alert_entries
from app.services.lacework_client import SEVERITY_ORDER

router = APIRouter()

SEVERITY_LEVELS = {"Critical": 1, "High": 2, "Medium": 3, "Low": 4, "Info": 5}


async def _load_cached(db: AsyncSession, instance_id: int, data_type: str) -> list[dict]:
    result = await db.execute(
        select(CachedData).where(
            CachedData.instance_id == instance_id,
            CachedData.data_type == data_type,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return []
    return json.loads(row.json_data)


@router.get("", response_model=AlertPageData)
async def get_alerts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    min_severity: str | None = Query(None),
):
    # If no min_severity specified, load from user settings
    if min_severity is None:
        settings_result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user.id)
        )
        user_settings = settings_result.scalar_one_or_none()
        min_severity = user_settings.composite_alert_min_severity if user_settings else "High"

    min_sev_level = SEVERITY_LEVELS.get(min_severity, 2)

    result = await db.execute(
        select(Instance).where(Instance.is_enabled == True).order_by(Instance.name)
    )
    instances = list(result.scalars().all())

    if not instances:
        return AlertPageData(total_alerts=0, instances=[], items=[])

    all_items: list[AlertEntry] = []
    instance_summaries: list[AlertInstanceSummary] = []
    total_alerts = 0

    for inst in instances:
        alerts = await _load_cached(db, inst.id, "alerts")

        # Filter to composite alerts at or above the minimum severity
        composite = [
            a for a in alerts
            if a.get("alertType") in COMPOSITE_ALERT_TYPES
            and SEVERITY_LEVELS.get(a.get("severity", ""), 5) <= min_sev_level
        ]

        count = len(composite)
        total_alerts += count

        instance_summaries.append(
            AlertInstanceSummary(
                instance_name=inst.name,
                alert_count=count,
            )
        )

        all_items.extend(_build_alert_entries(inst.name, composite))

    all_items.sort(key=lambda a: (SEVERITY_ORDER.get(a.severity, 5), a.created_time))

    return AlertPageData(
        total_alerts=total_alerts,
        instances=instance_summaries,
        items=all_items,
    )
