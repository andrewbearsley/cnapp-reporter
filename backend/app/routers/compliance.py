import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import CachedData, Instance, User
from app.schemas import ComplianceDetailEntry, ComplianceInstanceSummary, CompliancePageData

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


@router.get("", response_model=CompliancePageData)
async def get_compliance(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Instance).where(Instance.is_enabled == True).order_by(Instance.name)
    )
    instances = list(result.scalars().all())

    if not instances:
        return CompliancePageData(total_critical=0, instances=[], items=[])

    all_items: list[ComplianceDetailEntry] = []
    instance_summaries: list[ComplianceInstanceSummary] = []
    total_critical = 0

    for inst in instances:
        items = await _load_cached(db, inst.id, "compliance")

        critical_count = sum(1 for i in items if i.get("severity") == "Critical")
        total_critical += critical_count
        datasets = list({i.get("dataset", "Unknown") for i in items})

        instance_summaries.append(
            ComplianceInstanceSummary(
                instance_name=inst.name,
                critical_count=critical_count,
                datasets=sorted(datasets),
            )
        )

        for item in items:
            acct = item.get("account")
            if isinstance(acct, dict):
                acct = acct.get("accountName", acct.get("accountId", str(acct)))

            all_items.append(
                ComplianceDetailEntry(
                    instance_name=inst.name,
                    dataset=item.get("dataset", "Unknown"),
                    severity=item.get("severity", "Unknown"),
                    section=item.get("section"),
                    title=item.get("title", item.get("recommendation", "Unknown")),
                    reason=item.get("reason"),
                    resource=item.get("resource"),
                    region=item.get("region"),
                    account=acct,
                    status=item.get("status", "NonCompliant"),
                )
            )

    return CompliancePageData(
        total_critical=total_critical,
        instances=instance_summaries,
        items=all_items,
    )
