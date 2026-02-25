from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# Auth
class LoginRequest(BaseModel):
    username: str
    password: str


class SetupRequest(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthStatus(BaseModel):
    setup_required: bool


# Instances
class InstanceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    account: str = Field(min_length=1, max_length=200)
    api_key_id: str = Field(min_length=1)
    api_secret: str = Field(min_length=1)
    sub_account: str | None = None
    email: EmailStr | None = None


class InstanceUpdate(BaseModel):
    name: str | None = None
    account: str | None = None
    api_key_id: str | None = None
    api_secret: str | None = None
    sub_account: str | None = None
    email: EmailStr | None = None
    is_enabled: bool | None = None


class InstanceResponse(BaseModel):
    id: int
    name: str
    account: str
    base_url: str
    api_key_id: str
    sub_account: str | None
    email: str | None
    is_enabled: bool
    last_sync_at: datetime | None
    last_sync_status: str | None
    last_error: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestConnectionResponse(BaseModel):
    success: bool
    message: str


# Dashboard
class InstanceSummary(BaseModel):
    instance_id: int
    instance_name: str
    account: str
    status: str
    critical_alerts: int
    high_alerts: int
    composite_alerts: int
    critical_vulns: int
    high_vulns: int
    non_compliant_critical: int


class AlertEntry(BaseModel):
    instance_name: str
    alert_id: int
    severity: str
    alert_type: str
    title: str
    status: str
    created_time: str
    description: str | None = None
    category: str | None = None


class VulnEntry(BaseModel):
    instance_name: str
    vuln_id: str
    severity: str
    package: str | None = None
    version: str | None = None
    fix_version: str | None = None
    host_count: int = 0
    status: str = "Active"


class VulnDetailEntry(BaseModel):
    instance_name: str
    vuln_id: str
    severity: str
    package: str | None = None
    version: str | None = None
    fix_version: str | None = None
    hostname: str | None = None
    external_ip: str | None = None
    instance_id_tag: str | None = None
    status: str = "Active"


class ComplianceEntry(BaseModel):
    instance_name: str
    report_type: str
    severity: str
    title: str
    resource: str | None = None
    policy_id: str | None = None
    status: str


class ComplianceDetailEntry(BaseModel):
    instance_name: str
    dataset: str
    severity: str
    section: str | None = None
    title: str
    reason: str | None = None
    resource: str | None = None
    region: str | None = None
    account: str | None = None
    status: str


class ComplianceInstanceSummary(BaseModel):
    instance_name: str
    critical_count: int
    datasets: list[str]


class CompliancePageData(BaseModel):
    total_critical: int
    instances: list[ComplianceInstanceSummary]
    items: list[ComplianceDetailEntry]


class VulnInstanceSummary(BaseModel):
    instance_name: str
    critical_count: int
    high_count: int


class VulnPageData(BaseModel):
    total_critical: int
    total_high: int
    instances: list[VulnInstanceSummary]
    items: list[VulnDetailEntry]


class DashboardSummary(BaseModel):
    total_instances: int
    healthy_instances: int
    error_instances: int
    total_critical_alerts: int
    total_high_alerts: int
    total_composite_alerts: int
    total_critical_vulns: int
    total_exposed_critical_vulns: int
    total_high_vulns: int
    total_non_compliant_critical: int
    instances: list[InstanceSummary]
    recent_alerts: list[AlertEntry]
    recent_vulns: list[VulnEntry]
    recent_compliance: list[ComplianceEntry]


# Alerts page
class AlertInstanceSummary(BaseModel):
    instance_name: str
    alert_count: int


class AlertPageData(BaseModel):
    total_alerts: int
    instances: list[AlertInstanceSummary]
    items: list[AlertEntry]


# User settings
class UserSettingsResponse(BaseModel):
    composite_alert_min_severity: str

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    composite_alert_min_severity: str | None = None
