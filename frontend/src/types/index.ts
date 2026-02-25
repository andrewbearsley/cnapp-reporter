export interface Instance {
  id: number
  name: string
  account: string
  base_url: string
  api_key_id: string
  sub_account: string | null
  email: string | null
  is_enabled: boolean
  last_sync_at: string | null
  last_sync_status: string | null
  last_error: string | null
  created_at: string
}

export interface InstanceCreate {
  name: string
  account: string
  api_key_id: string
  api_secret: string
  sub_account?: string
  email?: string
}

export interface InstanceSummary {
  instance_id: number
  instance_name: string
  account: string
  status: string
  critical_alerts: number
  high_alerts: number
  composite_alerts: number
  critical_vulns: number
  high_vulns: number
  non_compliant_critical: number
}

export interface AlertEntry {
  instance_name: string
  alert_id: number
  severity: string
  alert_type: string
  title: string
  status: string
  created_time: string
  description: string | null
  category: string | null
}

export interface VulnEntry {
  instance_name: string
  vuln_id: string
  severity: string
  package: string | null
  version: string | null
  fix_version: string | null
  host_count: number
  status: string
}

export interface ComplianceEntry {
  instance_name: string
  report_type: string
  severity: string
  title: string
  resource: string | null
  policy_id: string | null
  status: string
}

// Compliance page
export interface ComplianceDetailEntry {
  instance_name: string
  dataset: string
  severity: string
  section: string | null
  title: string
  reason: string | null
  resource: string | null
  region: string | null
  account: string | null
  status: string
}

export interface ComplianceInstanceSummary {
  instance_name: string
  critical_count: number
  datasets: string[]
}

export interface CompliancePageData {
  total_critical: number
  instances: ComplianceInstanceSummary[]
  items: ComplianceDetailEntry[]
}

// Vulnerabilities page
export interface VulnDetailEntry {
  instance_name: string
  vuln_id: string
  severity: string
  package: string | null
  version: string | null
  fix_version: string | null
  hostname: string | null
  external_ip: string | null
  instance_id_tag: string | null
  status: string
}

export interface VulnInstanceSummary {
  instance_name: string
  critical_count: number
  high_count: number
}

export interface VulnPageData {
  total_critical: number
  total_high: number
  instances: VulnInstanceSummary[]
  items: VulnDetailEntry[]
}

export interface DashboardSummary {
  total_instances: number
  healthy_instances: number
  error_instances: number
  total_critical_alerts: number
  total_high_alerts: number
  total_composite_alerts: number
  total_critical_vulns: number
  total_exposed_critical_vulns: number
  total_high_vulns: number
  total_non_compliant_critical: number
  instances: InstanceSummary[]
  recent_alerts: AlertEntry[]
  recent_vulns: VulnEntry[]
  recent_compliance: ComplianceEntry[]
}

// Alerts page
export interface AlertInstanceSummary {
  instance_name: string
  alert_count: number
}

export interface AlertPageData {
  total_alerts: number
  instances: AlertInstanceSummary[]
  items: AlertEntry[]
}

// User settings
export interface UserSettings {
  composite_alert_min_severity: string
}
