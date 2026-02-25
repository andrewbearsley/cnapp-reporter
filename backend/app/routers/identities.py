import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import CachedData, Instance, User
from app.schemas import IdentityEntry, IdentityInstanceSummary, IdentityPageData

router = APIRouter()


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


def _parse_epoch_ms(val) -> str | None:
    """Convert epoch milliseconds to ISO string."""
    if val is None:
        return None
    try:
        ts = int(val) / 1000
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except (ValueError, TypeError, OSError):
        return None


def _days_since(epoch_ms) -> int | None:
    """Days since an epoch-ms timestamp."""
    if epoch_ms is None:
        return None
    try:
        ts = datetime.fromtimestamp(int(epoch_ms) / 1000, tz=timezone.utc)
        return (datetime.now(timezone.utc) - ts).days
    except (ValueError, TypeError, OSError):
        return None


def _extract_identity(instance_name: str, raw: dict) -> IdentityEntry:
    metrics = raw.get("METRICS") or {}
    if isinstance(metrics, str):
        metrics = json.loads(metrics)
    entitlements = raw.get("ENTITLEMENT_COUNTS") or {}
    if isinstance(entitlements, str):
        entitlements = json.loads(entitlements)

    # Access keys
    access_keys_raw = raw.get("ACCESS_KEYS_LIST") or raw.get("ACCESS_KEYS") or []
    if isinstance(access_keys_raw, str):
        access_keys_raw = json.loads(access_keys_raw)
    if isinstance(access_keys_raw, dict):
        access_keys_raw = list(access_keys_raw.values())

    access_keys = []
    for ak in access_keys_raw:
        if isinstance(ak, dict):
            access_keys.append({
                "key_id": ak.get("access_key_id", ""),
                "active": ak.get("active", False),
                "last_used": ak.get("last_used"),
                "created": ak.get("created_time"),
                "hard_coded": ak.get("hard_coded", False),
            })

    risks = metrics.get("risks", [])
    if isinstance(risks, str):
        risks = json.loads(risks)

    last_used_time = raw.get("LAST_USED_TIME")
    days_unused = _days_since(last_used_time)

    return IdentityEntry(
        instance_name=instance_name,
        principal_id=raw.get("PRINCIPAL_ID", ""),
        name=raw.get("NAME", ""),
        provider=raw.get("PROVIDER_TYPE", ""),
        domain_id=raw.get("DOMAIN_ID", ""),
        risk_score=metrics.get("risk_score", 0),
        risk_severity=metrics.get("risk_severity", "INFO"),
        risks=risks,
        last_used=_parse_epoch_ms(last_used_time),
        days_unused=days_unused,
        created=_parse_epoch_ms(raw.get("CREATED_TIME")),
        entitlements_total=entitlements.get("entitlements_total_count", 0),
        entitlements_unused=entitlements.get("entitlements_unused_count", 0),
        entitlements_unused_pct=entitlements.get("entitlements_unused_percentage", 0),
        services_total=entitlements.get("services_entitled_total_count", 0),
        services_unused=entitlements.get("services_unused_count", 0),
        access_keys=access_keys,
    )


RISK_SEVERITY_ORDER = {"CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4, "INFO": 5}


@router.get("", response_model=IdentityPageData)
async def get_identities(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Instance).where(Instance.is_enabled == True).order_by(Instance.name)
    )
    instances = list(result.scalars().all())

    if not instances:
        return IdentityPageData(
            total_identities=0,
            total_critical=0,
            total_high=0,
            instances=[],
            items=[],
        )

    all_items: list[IdentityEntry] = []
    instance_summaries: list[IdentityInstanceSummary] = []
    total_critical = 0
    total_high = 0

    for inst in instances:
        identities = await _load_cached(db, inst.id, "identities")

        critical = sum(
            1 for i in identities
            if isinstance(i.get("METRICS"), dict) and i["METRICS"].get("risk_severity") == "CRITICAL"
            or isinstance(i.get("METRICS"), str) and '"risk_severity": "CRITICAL"' in i["METRICS"]
        )
        high = sum(
            1 for i in identities
            if isinstance(i.get("METRICS"), dict) and i["METRICS"].get("risk_severity") == "HIGH"
            or isinstance(i.get("METRICS"), str) and '"risk_severity": "HIGH"' in i["METRICS"]
        )
        total_critical += critical
        total_high += high

        instance_summaries.append(
            IdentityInstanceSummary(
                instance_name=inst.name,
                identity_count=len(identities),
                critical_count=critical,
                high_count=high,
            )
        )

        for raw in identities:
            all_items.append(_extract_identity(inst.name, raw))

    all_items.sort(key=lambda i: RISK_SEVERITY_ORDER.get(i.risk_severity, 5))

    return IdentityPageData(
        total_identities=len(all_items),
        total_critical=total_critical,
        total_high=total_high,
        instances=instance_summaries,
        items=all_items,
    )
