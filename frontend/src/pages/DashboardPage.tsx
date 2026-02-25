import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bug, Server, ShieldAlert, RefreshCw, Loader2, ExternalLink, Search } from 'lucide-react'
import ActionMenu from '../components/ActionMenu'
import { getDashboardSummary } from '../api/dashboard'
import StatCard from '../components/StatCard'
import SeverityBadge from '../components/SeverityBadge'
import CsvDownloadButton from '../components/CsvDownload'
import StatusBadge from '../components/StatusBadge'
import ResizableTable from '../components/ResizableTable'
import type { DashboardSummary } from '../types'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'alerts' | 'vulns' | 'compliance'>('alerts')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const summary = await getDashboardSummary()
      setData(summary)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Manual refresh only - no auto-refresh
  }, [fetchData])

  const q = search.toLowerCase().trim()

  const filteredAlerts = useMemo(() => {
    if (!data) return []
    if (!q) return data.recent_alerts
    return data.recent_alerts.filter(a =>
      [a.instance_name, a.severity, a.category, a.title, a.alert_type, a.description, a.status]
        .some(v => v?.toLowerCase().includes(q))
    )
  }, [data, q])

  const filteredVulns = useMemo(() => {
    if (!data) return []
    if (!q) return data.recent_vulns
    return data.recent_vulns.filter(v =>
      [v.instance_name, v.severity, v.vuln_id, v.package, v.version, v.fix_version, v.status]
        .some(f => f?.toLowerCase().includes(q))
    )
  }, [data, q])

  const filteredCompliance = useMemo(() => {
    if (!data) return []
    if (!q) return data.recent_compliance
    return data.recent_compliance.filter(c =>
      [c.instance_name, c.severity, c.title, c.resource, c.policy_id, c.status]
        .some(f => f?.toLowerCase().includes(q))
    )
  }, [data, q])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Loading dashboard data from all instances...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-red-700 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Aggregated security posture across {data.total_instances} instance{data.total_instances !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Instances"
          value={data.total_instances}
          subtitle={`${data.healthy_instances} healthy`}
          icon={Server}
          color="blue"
          to="/instances"
        />
        <StatCard
          title="Composite Alerts"
          value={data.total_composite_alerts}
          subtitle="Behavioral detections (90 days)"
          icon={AlertTriangle}
          color="blue"
          to="/alerts"
        />
        <StatCard
          title="Critical Vulnerabilities"
          value={data.total_exposed_critical_vulns}
          subtitle="Potentially Internet Exposed"
          icon={Bug}
          color="blue"
          to="/vulnerabilities"
        />
        <StatCard
          title="Critical Compliance"
          value={data.total_non_compliant_critical}
          icon={ShieldAlert}
          color="blue"
          to="/compliance"
        />
      </div>

      {/* Per-instance overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Instance Overview</h2>
          <CsvDownloadButton
            data={data.instances.map(i => ({
              instance: i.instance_name, account: i.account, status: i.status,
              composite_alerts: i.composite_alerts,
              critical_vulns: i.critical_vulns,
              non_compliant_critical: i.non_compliant_critical,
            }))}
            filename={`instance-overview-${new Date().toISOString().slice(0, 10)}`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 text-left border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 font-medium">Instance</th>
                <th className="px-6 py-3 font-medium">Account</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-center">Composite Alerts</th>
                <th className="px-6 py-3 font-medium text-center">Critical Vulns</th>
                <th className="px-6 py-3 font-medium text-center">Non-Compliant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {data.instances.map((inst) => (
                <tr key={inst.instance_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{inst.instance_name}</td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{inst.account}</td>
                  <td className="px-6 py-3"><StatusBadge status={inst.status} /></td>
                  <td className="px-6 py-3 text-center">
                    <span className={inst.composite_alerts > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}>{inst.composite_alerts}</span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={inst.critical_vulns > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}>{inst.critical_vulns}</span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={inst.non_compliant_critical > 0 ? 'text-yellow-600 dark:text-yellow-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}>{inst.non_compliant_critical}</span>
                  </td>
                </tr>
              ))}
              {data.instances.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                    No instances configured. Add one from the Instances page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabbed detail tables */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => { setActiveTab('alerts'); setSearch('') }}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'alerts' ? 'text-gray-900 dark:text-white border-red-500' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Alerts ({data.recent_alerts.length})
          </button>
          <button
            onClick={() => { setActiveTab('vulns'); setSearch('') }}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'vulns' ? 'text-gray-900 dark:text-white border-orange-500' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Vulnerabilities ({data.recent_vulns.length})
          </button>
          <button
            onClick={() => { setActiveTab('compliance'); setSearch('') }}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'compliance' ? 'text-gray-900 dark:text-white border-yellow-500' : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Compliance ({data.recent_compliance.length})
          </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 w-48"
            />
          </div>
          <CsvDownloadButton
            data={activeTab === 'alerts'
              ? data.recent_alerts.map(a => ({ instance: a.instance_name, severity: a.severity, category: a.category ?? '', alert_id: a.alert_id, title: a.title, status: a.status, time: a.created_time }))
              : activeTab === 'vulns'
                ? data.recent_vulns.map(v => ({ instance: v.instance_name, severity: v.severity, cve: v.vuln_id, package: v.package ?? '', version: v.version ?? '', fix: v.fix_version ?? '', hosts: v.host_count }))
                : data.recent_compliance.map(c => ({ instance: c.instance_name, severity: c.severity, policy_id: c.policy_id ?? '', title: c.title, resource: c.resource ?? '', status: c.status }))
            }
            filename={`dashboard-${activeTab}-${new Date().toISOString().slice(0, 10)}`}
          />
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'alerts' && (
            <ResizableTable columns={[
              { key: 'instance', label: 'Instance', defaultWidth: 160, minWidth: 100 },
              { key: 'severity', label: 'Severity', defaultWidth: 100, minWidth: 80 },
              { key: 'category', label: 'Category', defaultWidth: 120, minWidth: 80 },
              { key: 'title', label: 'Title', defaultWidth: 320, minWidth: 150 },
              { key: 'status', label: 'Status', defaultWidth: 80, minWidth: 60 },
              { key: 'time', label: 'Time', defaultWidth: 170, minWidth: 120 },
              { key: 'action', label: 'Action', defaultWidth: 60, minWidth: 50, align: 'center' },
            ]}>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredAlerts.map((alert, i) => (
                  <tr key={`${alert.instance_name}-${alert.alert_id}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300 truncate">{alert.instance_name}</td>
                    <td className="px-6 py-3"><SeverityBadge severity={alert.severity} /></td>
                    <td className="px-6 py-3">
                      {alert.category ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400">
                          {alert.category}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-900 dark:text-white truncate" title={alert.description ?? alert.title}>{alert.title}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 truncate">{alert.status}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{alert.created_time ? new Date(alert.created_time).toLocaleString() : '-'}</td>
                    <td className="px-6 py-3 text-center"><ActionMenu /></td>
                  </tr>
                ))}
                {filteredAlerts.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">No alerts found</td></tr>
                )}
              </tbody>
            </ResizableTable>
          )}

          {activeTab === 'vulns' && (
            <ResizableTable columns={[
              { key: 'instance', label: 'Instance', defaultWidth: 160, minWidth: 100 },
              { key: 'severity', label: 'Severity', defaultWidth: 100, minWidth: 80 },
              { key: 'cve', label: 'CVE', defaultWidth: 160, minWidth: 100 },
              { key: 'package', label: 'Package', defaultWidth: 170, minWidth: 100 },
              { key: 'version', label: 'Version', defaultWidth: 110, minWidth: 80 },
              { key: 'fix', label: 'Fix', defaultWidth: 110, minWidth: 80 },
              { key: 'hosts', label: 'Hosts', defaultWidth: 60, minWidth: 50, align: 'center' },
              { key: 'action', label: 'Action', defaultWidth: 60, minWidth: 50, align: 'center' },
            ]}>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredVulns.map((vuln, i) => (
                  <tr key={`${vuln.instance_name}-${vuln.vuln_id}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300 truncate">{vuln.instance_name}</td>
                    <td className="px-6 py-3"><SeverityBadge severity={vuln.severity} /></td>
                    <td className="px-6 py-3 text-gray-900 dark:text-white font-mono text-xs truncate">{vuln.vuln_id}</td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300 truncate">{vuln.package ?? '-'}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs truncate">{vuln.version ?? '-'}</td>
                    <td className="px-6 py-3 text-green-600 dark:text-green-400 font-mono text-xs truncate">{vuln.fix_version ?? '-'}</td>
                    <td className="px-6 py-3 text-center text-gray-600 dark:text-gray-300">{vuln.host_count}</td>
                    <td className="px-6 py-3 text-center"><ActionMenu /></td>
                  </tr>
                ))}
                {filteredVulns.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">No vulnerabilities found</td></tr>
                )}
              </tbody>
            </ResizableTable>
          )}

          {activeTab === 'compliance' && (
            <ResizableTable columns={[
              { key: 'instance', label: 'Instance', defaultWidth: 160, minWidth: 100 },
              { key: 'severity', label: 'Severity', defaultWidth: 100, minWidth: 80 },
              { key: 'title', label: 'Title', defaultWidth: 350, minWidth: 200 },
              { key: 'resource', label: 'Resource', defaultWidth: 220, minWidth: 100 },
              { key: 'status', label: 'Status', defaultWidth: 100, minWidth: 70 },
              { key: 'action', label: 'Action', defaultWidth: 60, minWidth: 50, align: 'center' },
            ]}>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredCompliance.map((item, i) => (
                  <tr key={`${item.instance_name}-${item.title}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300 truncate">{item.instance_name}</td>
                    <td className="px-6 py-3"><SeverityBadge severity={item.severity} /></td>
                    <td className="px-6 py-3 text-gray-900 dark:text-white truncate" title={item.title}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{item.title}</span>
                        {item.policy_id && (
                          <a
                            href={`https://docs.fortinet.com/search?query=${encodeURIComponent(item.policy_id)}&product=FortiCNAPP`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-blue-500 hover:text-blue-400"
                            title={`Lookup ${item.policy_id} in docs`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs truncate" title={item.resource ?? ''}>{item.resource ?? '-'}</td>
                    <td className="px-6 py-3 text-red-600 dark:text-red-400 text-xs">{item.status}</td>
                    <td className="px-6 py-3 text-center"><ActionMenu /></td>
                  </tr>
                ))}
                {filteredCompliance.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">No compliance issues found</td></tr>
                )}
              </tbody>
            </ResizableTable>
          )}
        </div>
      </div>
    </div>
  )
}
