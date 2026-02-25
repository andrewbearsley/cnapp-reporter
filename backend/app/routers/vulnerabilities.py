import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import CachedData, Instance, User
from app.schemas import VulnDetailEntry, VulnInstanceSummary, VulnPageData
from app.services.lacework_client import SEVERITY_ORDER

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


def _extract_machine_info(vuln: dict) -> tuple[str | None, str | None, str | None]:
    tags = vuln.get("machineTags", {})
    if not isinstance(tags, dict):
        return None, None, None
    hostname = tags.get("Hostname", tags.get("hostname"))
    external_ip = tags.get("ExternalIp", tags.get("externalIp"))
    instance_id = tags.get("InstanceId", tags.get("instanceId", tags.get("AWSInstanceId")))
    return hostname, external_ip, instance_id


@router.get("", response_model=VulnPageData)
async def get_vulnerabilities(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Instance).where(Instance.is_enabled == True).order_by(Instance.name)
    )
    instances = list(result.scalars().all())

    if not instances:
        return VulnPageData(total_critical=0, total_high=0, instances=[], items=[])

    all_items: list[VulnDetailEntry] = []
    instance_summaries: list[VulnInstanceSummary] = []
    total_critical = 0
    total_high = 0

    for inst in instances:
        host_vulns = await _load_cached(db, inst.id, "host_vulns")
        container_vulns = await _load_cached(db, inst.id, "container_vulns")
        all_vulns = host_vulns + container_vulns

        critical = sum(1 for i in all_vulns if i.get("severity") == "Critical")
        high = sum(1 for i in all_vulns if i.get("severity") == "High")
        total_critical += critical
        total_high += high

        instance_summaries.append(
            VulnInstanceSummary(
                instance_name=inst.name,
                critical_count=critical,
                high_count=high,
            )
        )

        for item in all_vulns:
            feature = item.get("featureKey", {})
            fix_info = item.get("fixInfo", {})
            hostname, external_ip, instance_id = _extract_machine_info(item)

            all_items.append(
                VulnDetailEntry(
                    instance_name=inst.name,
                    vuln_id=item.get("vulnId", "unknown"),
                    severity=item.get("severity", "Unknown"),
                    package=feature.get("name") if isinstance(feature, dict) else None,
                    version=feature.get("version") if isinstance(feature, dict) else None,
                    fix_version=fix_info.get("fixed_version", fix_info.get("fixedVersion")) if isinstance(fix_info, dict) else None,
                    hostname=hostname,
                    external_ip=external_ip,
                    instance_id_tag=instance_id,
                    status=item.get("status", "Active"),
                )
            )

    all_items.sort(key=lambda v: SEVERITY_ORDER.get(v.severity, 5))

    return VulnPageData(
        total_critical=total_critical,
        total_high=total_high,
        instances=instance_summaries,
        items=all_items,
    )
