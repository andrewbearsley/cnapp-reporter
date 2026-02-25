import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {"Critical": 1, "High": 2, "Medium": 3, "Low": 4, "Info": 5}
COMPLIANCE_DATASETS = ["AwsCompliance", "GcpCompliance", "AzureCompliance"]


class LaceworkClient:
    def __init__(
        self,
        base_url: str,
        key_id: str,
        secret: str,
        sub_account: str | None = None,
    ):
        if not base_url.startswith("https://"):
            base_url = f"https://{base_url}"
        self.base_url = base_url
        self.key_id = key_id
        self.secret = secret
        self.sub_account = sub_account
        self._token: str | None = None
        self._token_expires: datetime | None = None
        self._client = httpx.AsyncClient(timeout=30.0)

    async def _ensure_token(self) -> str:
        if self._token and self._token_expires and datetime.now(timezone.utc) < self._token_expires:
            return self._token

        headers = {"X-LW-UAKS": self.secret, "Content-Type": "application/json"}
        if self.sub_account:
            headers["Account-Name"] = self.sub_account

        resp = await self._client.post(
            f"{self.base_url}/api/v2/access/tokens",
            json={"keyId": self.key_id, "expiryTime": 3600},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        if "data" in data and isinstance(data["data"], list):
            token_data = data["data"][0]
        else:
            token_data = data
        self._token = token_data["token"]
        expires_str = token_data["expiresAt"]
        self._token_expires = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
        return self._token

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        token = await self._ensure_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        if self.sub_account:
            headers["Account-Name"] = self.sub_account

        for attempt in range(3):
            resp = await self._client.request(
                method, f"{self.base_url}{path}", headers=headers, **kwargs
            )
            if resp.status_code == 429:
                delay = 30 * (attempt + 1)
                logger.warning("Rate limited on %s, retrying in %ds", path, delay)
                await asyncio.sleep(delay)
                continue
            if resp.status_code == 204:
                return {"data": []}
            resp.raise_for_status()
            return resp.json()

        raise Exception(f"Rate limited after 3 retries on {path}")

    async def _paginated_request(self, method: str, path: str, max_pages: int = 5, **kwargs) -> list:
        all_data = []
        data = await self._request(method, path, **kwargs)
        all_data.extend(data.get("data", []))

        pages = 1
        while pages < max_pages:
            next_page = data.get("paging", {}).get("urls", {}).get("nextPage")
            if not next_page:
                break
            data = await self._request("GET", next_page.replace(self.base_url, ""))
            all_data.extend(data.get("data", []))
            pages += 1

        return all_data

    def _time_filter_24h(self) -> dict:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=1)
        return {
            "startTime": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

    async def get_alerts(self, max_severity: str = "High") -> list[dict]:
        try:
            data = await self._request("GET", "/api/v2/Alerts", params={"details": "Details"})
            alerts = data.get("data", [])
            if max_severity:
                max_order = SEVERITY_ORDER.get(max_severity, 5)
                alerts = [
                    a for a in alerts if SEVERITY_ORDER.get(a.get("severity"), 5) <= max_order
                ]
            alerts.sort(key=lambda a: SEVERITY_ORDER.get(a.get("severity"), 5))
            return alerts
        except httpx.HTTPStatusError as e:
            logger.error("Failed to fetch alerts: %s", e)
            return []

    async def search_composite_alerts(self, lookback_days: int = 90) -> list[dict]:
        """Search for composite/behavioral alerts across a wide time range.

        The Alerts search API limits time windows to 7 days and lookback to 90 days.
        The alertType filter only supports 'eq' (not 'in'), so we query each type
        separately within each time chunk and deduplicate by alertId.
        """
        composite_types = [
            "PotentiallyCompromisedAwsCredentials",
            "PotentiallyCompromisedAwsIdentity",
            "PotentiallyCompromisedHost",
            "SuspiciousActivityAwsUser",
            "SuspiciousActivityHost",
            "SuspiciousActivityGCP",
            "SuspiciousActivityAzure",
            "CompromisedAwsHost",
        ]
        now = datetime.now(timezone.utc)
        all_alerts: dict[int, dict] = {}
        chunk_days = 7

        for offset in range(0, lookback_days, chunk_days):
            end = now - timedelta(days=offset)
            start = now - timedelta(days=min(offset + chunk_days, lookback_days))
            time_filter = {
                "startTime": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "endTime": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

            # Query each composite alert type in parallel within this chunk
            async def _search_type(alert_type: str) -> list[dict]:
                body = {
                    "timeFilter": time_filter,
                    "filters": [
                        {"field": "alertType", "expression": "eq", "value": alert_type},
                    ],
                }
                try:
                    return await self._paginated_request(
                        "POST", "/api/v2/Alerts/search", json=body, max_pages=2
                    )
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 204:
                        return []
                    logger.debug("Composite search %s: %s", alert_type, e)
                    return []
                except Exception:
                    return []

            chunk_results = await asyncio.gather(
                *[_search_type(t) for t in composite_types]
            )
            for results in chunk_results:
                for alert in results:
                    aid = alert.get("alertId")
                    if aid and aid not in all_alerts:
                        all_alerts[aid] = alert

        alerts = list(all_alerts.values())
        alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a.get("severity"), 5), a.get("startTime", "")))
        return alerts

    async def search_host_vulns(self, severity: str = "Critical") -> list[dict]:
        body = {
            "timeFilter": self._time_filter_24h(),
            "filters": [
                {"field": "severity", "expression": "in", "values": [severity, "Critical"]},
            ],
            "returns": [
                "vulnId",
                "severity",
                "status",
                "fixInfo",
                "featureKey",
                "machineTags",
            ],
        }
        try:
            return await self._paginated_request(
                "POST", "/api/v2/Vulnerabilities/Hosts/search", json=body, max_pages=3
            )
        except httpx.HTTPStatusError as e:
            logger.error("Failed to fetch host vulns: %s", e)
            return []

    async def search_container_vulns(self, severity: str = "Critical") -> list[dict]:
        body = {
            "timeFilter": self._time_filter_24h(),
            "filters": [
                {"field": "severity", "expression": "in", "values": [severity, "Critical"]},
            ],
            "returns": [
                "vulnId",
                "severity",
                "status",
                "fixInfo",
                "featureKey",
                "imageId",
            ],
        }
        try:
            return await self._paginated_request(
                "POST", "/api/v2/Vulnerabilities/Containers/search", json=body, max_pages=3
            )
        except httpx.HTTPStatusError as e:
            logger.error("Failed to fetch container vulns: %s", e)
            return []

    async def search_vulns_detailed(self, severity: str = "Critical") -> list[dict]:
        """Fetch host vulns with machine details for the vulnerability page."""
        body = {
            "timeFilter": self._time_filter_24h(),
            "filters": [
                {"field": "severity", "expression": "in", "values": ["Critical", "High"]},
            ],
            "returns": [
                "vulnId",
                "severity",
                "status",
                "fixInfo",
                "featureKey",
                "machineTags",
                "startTime",
                "endTime",
            ],
        }
        try:
            return await self._paginated_request(
                "POST", "/api/v2/Vulnerabilities/Hosts/search", json=body, max_pages=5
            )
        except httpx.HTTPStatusError as e:
            logger.error("Failed to fetch detailed vulns: %s", e)
            return []

    async def get_compliance_evaluations(self) -> list[dict]:
        """Fetch critical/high non-compliant evaluations across all cloud providers."""
        all_results = []
        for dataset in COMPLIANCE_DATASETS:
            body = {
                "timeFilter": self._time_filter_24h(),
                "dataset": dataset,
                "filters": [
                    {"field": "severity", "expression": "in", "values": ["Critical", "High"]},
                    {"field": "status", "expression": "eq", "value": "NonCompliant"},
                ],
            }
            try:
                results = await self._paginated_request(
                    "POST", "/api/v2/Configs/ComplianceEvaluations/search",
                    json=body, max_pages=2,
                )
                for r in results:
                    r["dataset"] = dataset
                all_results.extend(results)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 204:
                    continue
                logger.error("Failed to fetch compliance for %s: %s", dataset, e)
            except Exception as e:
                logger.error("Failed to fetch compliance for %s: %s", dataset, e)
        return all_results

    async def get_compliance_critical_only(self) -> list[dict]:
        """Fetch only critical non-compliant evaluations for the compliance page."""
        all_results = []
        for dataset in COMPLIANCE_DATASETS:
            body = {
                "timeFilter": self._time_filter_24h(),
                "dataset": dataset,
                "filters": [
                    {"field": "severity", "expression": "eq", "value": "Critical"},
                    {"field": "status", "expression": "eq", "value": "NonCompliant"},
                ],
            }
            try:
                results = await self._paginated_request(
                    "POST", "/api/v2/Configs/ComplianceEvaluations/search",
                    json=body, max_pages=3,
                )
                for r in results:
                    r["dataset"] = dataset
                all_results.extend(results)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 204:
                    continue
                logger.error("Compliance %s: %s", dataset, e)
            except Exception as e:
                logger.error("Compliance %s: %s", dataset, e)
        return all_results

    async def get_identities(self, lookback_days: int = 7) -> list[dict]:
        """Fetch cloud identities via LQL query on LW_CE_IDENTITIES."""
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=lookback_days)
        body = {
            "query": {
                "queryText": "{ source { LW_CE_IDENTITIES I } return { I.* } }",
            },
            "arguments": [
                {"name": "StartTimeRange", "value": start.strftime("%Y-%m-%dT%H:%M:%SZ")},
                {"name": "EndTimeRange", "value": now.strftime("%Y-%m-%dT%H:%M:%SZ")},
            ],
        }
        try:
            data = await self._request("POST", "/api/v2/Queries/execute", json=body)
            return data.get("data", [])
        except httpx.HTTPStatusError as e:
            logger.error("Failed to fetch identities: %s", e)
            return []

    async def test_connection(self) -> tuple[bool, str]:
        try:
            await self._ensure_token()
            return True, "Connection successful"
        except httpx.HTTPStatusError as e:
            return False, f"HTTP {e.response.status_code}: {e.response.text[:200]}"
        except Exception as e:
            return False, str(e)

    async def close(self):
        await self._client.aclose()
