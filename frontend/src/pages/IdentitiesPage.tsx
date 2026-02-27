import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, RefreshCw, Loader2, Search, KeyRound } from 'lucide-react'
import { getIdentities } from '../api/identities'
import ActionMenu from '../components/ActionMenu'
import CsvDownloadButton from '../components/CsvDownload'
import ResizableTable from '../components/ResizableTable'
import type { IdentityPageData } from '../types'

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  LOW: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  INFO: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const RISK_LABELS: Record<string, string> = {
  ALLOWS_FULL_ADMIN: 'Full Admin',
  ALLOWS_IAM_WRITE: 'IAM Write',
  ALLOWS_COMPUTE_EXECUTE: 'Compute Execute',
  ALLOWS_STORAGE_READ: 'Storage Read',
  ALLOWS_STORAGE_WRITE: 'Storage Write',
  ALLOWS_SECRETS_READ: 'Secrets Read',
  ALLOWS_CREDENTIAL_EXPOSURE: 'Credential Exposure',
  ALLOWS_RESOURCE_EXPOSURE: 'Resource Exposure',
  ALLOWS_PRIVILEGE_PASSING: 'Privilege Passing',
  PASSWORD_LOGIN_NO_MFA: 'No MFA',
  AWS_ROOT_USER_PASSWORD_LOGIN_NO_MFA: 'Root No MFA',
  INACTIVE_ACCESS_KEY: 'Inactive Key',
  UNUSED_180DAYS_USER: 'Unused 180d',
  UNUSED_180DAYS_FULL_ADMIN: 'Unused Admin 180d',
  UNUSED_180DAYS_IAM_WRITE: 'Unused IAM Write 180d',
  AI_READ: 'AI Read',
  AI_WRITE: 'AI Write',
}

function RiskSeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.INFO}`}>
      {severity}
    </span>
  )
}

function formatRisk(risk: string): string {
  return RISK_LABELS[risk] ?? risk.replace(/^(ALLOWS_|DISABLED_WITH_)/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export default function IdentitiesPage() {
  const [data, setData] = useState<IdentityPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [instanceFilter, setInstanceFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [excessiveOnly, setExcessiveOnly] = useState(false)
  const [unusedOnly, setUnusedOnly] = useState(false)

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const result = await getIdentities()
      setData(result)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to load identity data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const q = search.toLowerCase().trim()

  const filtered = useMemo(() => {
    if (!data) return []
    return data.items.filter(item => {
      const matchesSearch = !q ||
        [item.name, item.principal_id, item.provider, item.domain_id, item.instance_name, ...item.risks]
          .some(v => v?.toLowerCase().includes(q))
      const matchesInstance = instanceFilter === 'all' || item.instance_name === instanceFilter
      const matchesSeverity = severityFilter === 'all' || item.risk_severity === severityFilter
      const matchesExcessive = !excessiveOnly || item.entitlements_unused_pct >= 75
      const matchesUnused = !unusedOnly || (item.days_unused != null && item.days_unused >= 180)
      return matchesSearch && matchesInstance && matchesSeverity && matchesExcessive && matchesUnused
    })
  }, [data, q, instanceFilter, severityFilter, excessiveOnly, unusedOnly])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Loading identity data...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-red-700 dark:text-red-400">{error}</div>
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Identities</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cloud identities and entitlements across all instances (CIEM)
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

      {/* Instance summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.instances.map((inst) => (
          <div
            key={inst.instance_name}
            onClick={() => setInstanceFilter(instanceFilter === inst.instance_name ? 'all' : inst.instance_name)}
            className={`bg-white dark:bg-gray-800 rounded-xl border p-5 cursor-pointer transition-colors ${
              instanceFilter === inst.instance_name ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{inst.instance_name}</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{inst.critical_count}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Critical risk &middot; {inst.identity_count} identities total
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-300 dark:text-blue-500/30" />
            </div>
          </div>
        ))}
        {data.instances.length === 0 && (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
            No identity data available. Sync instances to load CIEM data.
          </div>
        )}
      </div>

      {/* Filter toggles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExcessiveOnly(!excessiveOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              excessiveOnly
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
          >
            <KeyRound className="h-3 w-3" />
            Excessive Permissions
          </button>
          <button
            onClick={() => setUnusedOnly(!unusedOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              unusedOnly
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
          >
            Unused 180d+
          </button>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="pl-3 pr-8 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>
        </div>
        {instanceFilter !== 'all' && (
          <button onClick={() => setInstanceFilter('all')} className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            Clear: {instanceFilter}
          </button>
        )}
        <span className="text-sm text-gray-400 dark:text-gray-500">
          {filtered.length} identities
        </span>
      </div>

      {/* Identities table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex-shrink-0">Cloud Identities ({filtered.length})</h2>
          <div className="flex-1" />
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
            data={filtered.map(i => ({
              instance: i.instance_name,
              name: i.name,
              provider: i.provider,
              account: i.domain_id,
              risk_severity: i.risk_severity,
              risk_score: i.risk_score,
              risks: i.risks.join('; '),
              last_used: i.last_used ?? '',
              days_unused: i.days_unused ?? '',
              entitlements_total: i.entitlements_total,
              entitlements_unused: i.entitlements_unused,
              unused_pct: i.entitlements_unused_pct,
              access_keys: i.access_keys.length,
            }))}
            filename={`identities-${new Date().toISOString().slice(0, 10)}`}
          />
        </div>
        <div className="overflow-x-auto">
          <ResizableTable columns={[
            { key: 'instance', label: 'Instance', defaultWidth: 150, minWidth: 100 },
            { key: 'name', label: 'Name', defaultWidth: 200, minWidth: 120 },
            { key: 'provider', label: 'Provider', defaultWidth: 80, minWidth: 60 },
            { key: 'risk', label: 'Risk', defaultWidth: 90, minWidth: 70 },
            { key: 'risks', label: 'Risk Factors', defaultWidth: 280, minWidth: 150 },
            { key: 'unused_pct', label: 'Unused %', defaultWidth: 90, minWidth: 70, align: 'center' },
            { key: 'last_used', label: 'Last Used', defaultWidth: 130, minWidth: 90 },
            { key: 'keys', label: 'Keys', defaultWidth: 60, minWidth: 45, align: 'center' },
            { key: 'action', label: 'Action', defaultWidth: 60, minWidth: 50 },
          ]}>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.slice(0, 200).map((item, i) => (
                <tr key={`${item.instance_name}-${item.principal_id}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300 truncate">{item.instance_name}</td>
                  <td className="px-6 py-3 text-gray-900 dark:text-white truncate" title={item.principal_id}>
                    {item.name}
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.provider}</span>
                  </td>
                  <td className="px-6 py-3">
                    <RiskSeverityBadge severity={item.risk_severity} />
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.risks.filter(r => !r.startsWith('DISABLED_WITH_')).slice(0, 4).map(risk => (
                        <span key={risk} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" title={risk}>
                          {formatRisk(risk)}
                        </span>
                      ))}
                      {item.risks.filter(r => !r.startsWith('DISABLED_WITH_')).length > 4 && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">+{item.risks.filter(r => !r.startsWith('DISABLED_WITH_')).length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`text-xs font-semibold ${
                      item.entitlements_unused_pct >= 90 ? 'text-red-600 dark:text-red-400' :
                      item.entitlements_unused_pct >= 75 ? 'text-orange-600 dark:text-orange-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {item.entitlements_unused_pct > 0 ? `${Math.round(item.entitlements_unused_pct)}%` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {item.days_unused != null ? (
                      <span className={item.days_unused >= 180 ? 'text-red-600 dark:text-red-400 font-medium' : item.days_unused >= 90 ? 'text-orange-600 dark:text-orange-400' : ''}>
                        {item.days_unused}d ago
                      </span>
                    ) : item.last_used ? (
                      new Date(item.last_used).toLocaleDateString()
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">never</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                    {item.access_keys.length > 0 ? (
                      <span className="font-medium">{item.access_keys.length}</span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3"><ActionMenu /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                  {search ? `No identities matching "${search}"` : 'No identities match current filters'}
                </td></tr>
              )}
            </tbody>
          </ResizableTable>
        </div>
        {filtered.length > 200 && (
          <div className="px-6 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
            Showing 200 of {filtered.length} identities. Use search to narrow down.
          </div>
        )}
      </div>
    </div>
  )
}
