import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import decrypt_secret
from app.models import Instance
from app.schemas import (
    AlertEntry,
    ComplianceEntry,
    DashboardSummary,
    InstanceSummary,
    VulnEntry,
)
from app.services.lacework_client import SEVERITY_ORDER, LaceworkClient

logger = logging.getLogger(__name__)

COMPOSITE_ALERT_TYPES = {
    "PotentiallyCompromisedAwsCredentials",
    "PotentiallyCompromisedAwsIdentity",
    "PotentiallyCompromisedHost",
    "SuspiciousActivityAwsUser",
    "SuspiciousActivityHost",
    "SuspiciousActivityGCP",
    "SuspiciousActivityAzure",
    "CompromisedAwsHost",
}


async def _fetch_instance_data(instance: Instance) -> dict:
    secret = decrypt_secret(instance.api_secret_enc)
    client = LaceworkClient(
        instance.base_url, instance.api_key_id, secret, instance.sub_account
    )
    try:
        alerts, composite_alerts, host_vulns, container_vulns, compliance, identities = await asyncio.gather(
            client.get_alerts(max_severity="Critical"),
            client.search_composite_alerts(lookback_days=90),
            client.search_host_vulns(severity="High"),
            client.search_container_vulns(severity="High"),
            client.get_compliance_evaluations(),
            client.get_identities(lookback_days=7),
            return_exceptions=False,
        )
        # Merge: critical alerts + all composite alerts (deduped)
        seen_ids = {a.get("alertId") for a in alerts}
        for ca in composite_alerts:
            if ca.get("alertId") not in seen_ids:
                alerts.append(ca)
                seen_ids.add(ca.get("alertId"))
        return {
            "status": "healthy",
            "alerts": alerts,
            "host_vulns": host_vulns,
            "container_vulns": container_vulns,
            "compliance": compliance,
            "identities": identities,
            "error": None,
        }
    except Exception as e:
        logger.error("Error fetching data for %s: %s", instance.name, e)
        return {
            "status": "error",
            "alerts": [],
            "host_vulns": [],
            "container_vulns": [],
            "compliance": [],
            "identities": [],
            "error": str(e),
        }
    finally:
        await client.close()


def _count_by_severity(items: list[dict], severity: str) -> int:
    return sum(1 for item in items if item.get("severity") == severity)


def _build_alert_entries(instance_name: str, alerts: list[dict]) -> list[AlertEntry]:
    entries = []
    for a in alerts:
        info = a.get("alertInfo", {})
        derived = a.get("derivedFields", {})
        entries.append(
            AlertEntry(
                instance_name=instance_name,
                alert_id=a.get("alertId", 0),
                severity=a.get("severity", "Unknown"),
                alert_type=a.get("alertType", a.get("alertName", "Unknown")),
                title=a.get("alertName", a.get("alertType", "Unknown")),
                status=a.get("status", "Open"),
                created_time=a.get("startTime", a.get("createdTime", "")),
                description=info.get("description") if isinstance(info, dict) else None,
                category=derived.get("category") if isinstance(derived, dict) else None,
            )
        )
    return entries


def _build_vuln_entries(instance_name: str, vulns: list[dict]) -> list[VulnEntry]:
    seen = {}
    for v in vulns:
        vuln_id = v.get("vulnId", "unknown")
        if vuln_id in seen:
            seen[vuln_id]["host_count"] += 1
            continue
        feature = v.get("featureKey", {})
        fix_info = v.get("fixInfo", {})
        seen[vuln_id] = {
            "instance_name": instance_name,
            "vuln_id": vuln_id,
            "severity": v.get("severity", "Unknown"),
            "package": feature.get("name") if isinstance(feature, dict) else None,
            "version": feature.get("version") if isinstance(feature, dict) else None,
            "fix_version": fix_info.get("fixed_version", fix_info.get("fixedVersion")) if isinstance(fix_info, dict) else None,
            "host_count": 1,
            "status": v.get("status", "Active"),
        }
    entries = sorted(seen.values(), key=lambda x: SEVERITY_ORDER.get(x["severity"], 5))
    return [VulnEntry(**e) for e in entries[:30]]


def _build_compliance_entries(instance_name: str, items: list[dict]) -> list[ComplianceEntry]:
    entries = []
    for c in items[:20]:
        entries.append(
            ComplianceEntry(
                instance_name=instance_name,
                report_type=c.get("dataset", c.get("reportType", "Unknown")),
                severity=c.get("severity", "Unknown"),
                title=c.get("recommendation", c.get("title", c.get("recommendationTitle", "Unknown"))),
                resource=c.get("resource", c.get("resourceName")),
                policy_id=c.get("id"),
                status=c.get("status", "NonCompliant"),
            )
        )
    return entries


async def get_dashboard_summary(db: AsyncSession) -> DashboardSummary:
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
            total_high_vulns=0,
            total_non_compliant_critical=0,
            instances=[],
            recent_alerts=[],
            recent_vulns=[],
            recent_compliance=[],
        )

    tasks = [_fetch_instance_data(inst) for inst in instances]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    instance_summaries = []
    all_alerts: list[AlertEntry] = []
    all_vulns: list[VulnEntry] = []
    all_compliance: list[ComplianceEntry] = []
    total_critical_alerts = 0
    total_high_alerts = 0
    total_composite_alerts = 0
    total_critical_vulns = 0
    total_high_vulns = 0
    total_non_compliant_critical = 0
    healthy = 0
    errored = 0

    for inst, data in zip(instances, results):
        if isinstance(data, Exception):
            data = {
                "status": "error",
                "alerts": [],
                "host_vulns": [],
                "container_vulns": [],
                "compliance": [],
                "identities": [],
                "error": str(data),
            }

        all_vulns_raw = data["host_vulns"] + data["container_vulns"]
        critical_alerts = _count_by_severity(data["alerts"], "Critical")
        high_alerts = _count_by_severity(data["alerts"], "High")
        composite_alerts = sum(
            1 for a in data["alerts"]
            if a.get("alertType") in COMPOSITE_ALERT_TYPES
        )
        critical_vulns = _count_by_severity(all_vulns_raw, "Critical")
        high_vulns = _count_by_severity(all_vulns_raw, "High")
        non_compliant_crit = _count_by_severity(data["compliance"], "Critical")

        total_critical_alerts += critical_alerts
        total_high_alerts += high_alerts
        total_composite_alerts += composite_alerts
        total_critical_vulns += critical_vulns
        total_high_vulns += high_vulns
        total_non_compliant_critical += non_compliant_crit

        is_healthy = data["status"] == "healthy"
        if is_healthy:
            healthy += 1
        else:
            errored += 1

        # Update sync status in DB
        inst.last_sync_at = datetime.now(timezone.utc)
        inst.last_sync_status = data["status"]
        inst.last_error = data.get("error")

        instance_summaries.append(
            InstanceSummary(
                instance_id=inst.id,
                instance_name=inst.name,
                account=inst.account,
                status=data["status"],
                critical_alerts=critical_alerts,
                high_alerts=high_alerts,
                composite_alerts=composite_alerts,
                critical_vulns=critical_vulns,
                high_vulns=high_vulns,
                non_compliant_critical=non_compliant_crit,
            )
        )

        all_alerts.extend(_build_alert_entries(inst.name, data["alerts"]))
        all_vulns.extend(_build_vuln_entries(inst.name, all_vulns_raw))
        all_compliance.extend(_build_compliance_entries(inst.name, data["compliance"]))

    await db.commit()

    # Sort: critical first, then high
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
        total_high_vulns=total_high_vulns,
        total_non_compliant_critical=total_non_compliant_critical,
        instances=instance_summaries,
        recent_alerts=all_alerts[:50],
        recent_vulns=all_vulns[:50],
        recent_compliance=all_compliance[:50],
    )
