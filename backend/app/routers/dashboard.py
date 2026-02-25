import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import CachedData, Instance, User
from app.schemas import (
    AlertEntry,
    ComplianceEntry,
    DashboardSummary,
    InstanceSummary,
    VulnEntry,
)
from app.services.aggregator import COMPOSITE_ALERT_TYPES, _build_alert_entries, _build_compliance_entries, _build_vuln_entries, _count_by_severity
from app.services.lacework_client import SEVERITY_ORDER

router = APIRouter()


def _has_external_ip(vuln: dict) -> bool:
    tags = vuln.get("machineTags", {})
    if not isinstance(tags, dict):
        return False
    ip = tags.get("ExternalIp", tags.get("externalIp"))
    return bool(ip)


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


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Instance).where(Instance.is_enabled == True).order_by(Instance.name)
    )
    instances = list(result.scalars().all())

    if not instances:
        return DashboardSummary(
            total_instances=0,
            healthy_instances=0,
            error_instances=0,
            total_critical_alerts=0,
            total_high_alerts=0,
            total_composite_alerts=0,
            total_critical_vulns=0,
            total_exposed_critical_vulns=0,
            total_high_vulns=0,
            total_non_compliant_critical=0,
            instances=[],
            recent_alerts=[],
            recent_vulns=[],
            recent_compliance=[],
        )

    instance_summaries: list[InstanceSummary] = []
    all_alerts: list[AlertEntry] = []
    all_vulns: list[VulnEntry] = []
    all_compliance: list[ComplianceEntry] = []
    total_critical_alerts = 0
    total_high_alerts = 0
    total_composite_alerts = 0
    total_critical_vulns = 0
    total_exposed_critical_vulns = 0
    total_high_vulns = 0
    total_non_compliant_critical = 0
    healthy = 0
    errored = 0

    for inst in instances:
        alerts = await _load_cached(db, inst.id, "alerts")
        host_vulns = await _load_cached(db, inst.id, "host_vulns")
        container_vulns = await _load_cached(db, inst.id, "container_vulns")
        compliance = await _load_cached(db, inst.id, "compliance")

        all_vulns_raw = host_vulns + container_vulns
        critical_alerts = _count_by_severity(alerts, "Critical")
        high_alerts = _count_by_severity(alerts, "High")
        composite_alerts = sum(
            1 for a in alerts
            if a.get("alertType") in COMPOSITE_ALERT_TYPES
        )
        critical_vulns = _count_by_severity(all_vulns_raw, "Critical")
        exposed_critical_vulns = sum(
            1 for v in all_vulns_raw
            if v.get("severity") == "Critical"
            and _has_external_ip(v)
        )
        high_vulns = _count_by_severity(all_vulns_raw, "High")
        non_compliant_crit = _count_by_severity(compliance, "Critical")

        total_critical_alerts += critical_alerts
        total_high_alerts += high_alerts
        total_composite_alerts += composite_alerts
        total_critical_vulns += critical_vulns
        total_exposed_critical_vulns += exposed_critical_vulns
        total_high_vulns += high_vulns
        total_non_compliant_critical += non_compliant_crit

        is_healthy = inst.last_sync_status == "healthy"
        if is_healthy:
            healthy += 1
        elif inst.last_sync_status == "error":
            errored += 1

        instance_summaries.append(
            InstanceSummary(
                instance_id=inst.id,
                instance_name=inst.name,
                account=inst.account,
                status=inst.last_sync_status or "pending",
                critical_alerts=critical_alerts,
                high_alerts=high_alerts,
                composite_alerts=composite_alerts,
                critical_vulns=critical_vulns,
                high_vulns=high_vulns,
                non_compliant_critical=non_compliant_crit,
            )
        )

        all_alerts.extend(_build_alert_entries(inst.name, alerts))
        all_vulns.extend(_build_vuln_entries(inst.name, all_vulns_raw))
        all_compliance.extend(_build_compliance_entries(inst.name, compliance))

    all_alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a.severity, 5), a.created_time))
    all_vulns.sort(key=lambda v: SEVERITY_ORDER.get(v.severity, 5))
    all_compliance.sort(key=lambda c: SEVERITY_ORDER.get(c.severity, 5))

    return DashboardSummary(
        total_instances=len(instances),
        healthy_instances=healthy,
        error_instances=errored,
        total_critical_alerts=total_critical_alerts,
        total_high_alerts=total_high_alerts,
        total_composite_alerts=total_composite_alerts,
        total_critical_vulns=total_critical_vulns,
        total_exposed_critical_vulns=total_exposed_critical_vulns,
        total_high_vulns=total_high_vulns,
        total_non_compliant_critical=total_non_compliant_critical,
        instances=instance_summaries,
        recent_alerts=all_alerts[:50],
        recent_vulns=all_vulns[:50],
        recent_compliance=all_compliance[:50],
    )
