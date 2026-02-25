import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bug, RefreshCw, Loader2, Search, Globe, Wrench } from 'lucide-react'
import { getVulnerabilities } from '../api/vulnerabilities'
import SeverityBadge from '../components/SeverityBadge'
import CsvDownloadButton from '../components/CsvDownload'
import ResizableTable from '../components/ResizableTable'
import type { VulnPageData } from '../types'

export default function VulnerabilitiesPage() {
  const [data, setData] = useState<VulnPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [instanceFilter, setInstanceFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('Critical')
  const [internetExposed, setInternetExposed] = useState(true)
  const [fixableOnly, setFixableOnly] = useState(false)

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const result = await getVulnerabilities()
      setData(result)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to load vulnerability data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const searchLower = search.toLowerCase()

  const filtered = useMemo(() => {
    if (!data) return []
    return data.items.filter((item) => {
      const matchesSearch = !search ||
        item.vuln_id.toLowerCase().includes(searchLower) ||
        (item.package ?? '').toLowerCase().includes(searchLower) ||
        (item.hostname ?? '').toLowerCase().includes(searchLower) ||
        (item.instance_id_tag ?? '').toLowerCase().includes(searchLower)
      const matchesInstance = instanceFilter === 'all' || item.instance_name === instanceFilter
      const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter
      const matchesExposed = !internetExposed || (item.external_ip != null && item.external_ip !== '')
      const matchesFixable = !fixableOnly || (item.fix_version != null && item.fix_version !== '')
      return matchesSearch && matchesInstance && matchesSeverity && matchesExposed && matchesFixable
    })
  }, [data, search, searchLower, instanceFilter, severityFilter, internetExposed, fixableOnly])

  // Group by package for the actionable summary
  const sortedPackages = useMemo(() => {
    const packageGroups = new Map<string, {
      package: string
      severity: string
      versions: Set<string>
      fix_versions: Set<string>
      cves: Set<string>
      hosts: Set<string>
      instances: Set<string>
      count: number
    }>()

    for (const item of filtered) {
      const pkg = item.package ?? 'unknown'
      const existing = packageGroups.get(pkg)
      if (existing) {
        existing.count++
        if (item.version) existing.versions.add(item.version)
        if (item.fix_version) existing.fix_versions.add(item.fix_version)
        existing.cves.add(item.vuln_id)
        if (item.hostname) existing.hosts.add(item.hostname)
        existing.instances.add(item.instance_name)
        if (item.severity === 'Critical') existing.severity = 'Critical'
      } else {
        packageGroups.set(pkg, {
          package: pkg,
          severity: item.severity,
          versions: new Set(item.version ? [item.version] : []),
          fix_versions: new Set(item.fix_version ? [item.fix_version] : []),
          cves: new Set([item.vuln_id]),
          hosts: new Set(item.hostname ? [item.hostname] : []),
          instances: new Set([item.instance_name]),
          count: 1,
        })
      }
    }

    return [...packageGroups.values()].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'Critical' ? -1 : 1
      return b.hosts.size - a.hosts.size
    })
  }, [filtered])

  // Counts for the header
  const { totalCritical, exposedCritical, exposedHosts, exposedByInstance } = useMemo(() => {
    if (!data) return { totalCritical: 0, exposedCritical: 0, exposedHosts: 0, exposedByInstance: new Map<string, number>() }
    const tc = data.total_critical
    const ec = data.items.filter(i => i.severity === 'Critical' && i.external_ip).length
    const eh = new Set(data.items.filter(i => i.external_ip).map(i => i.hostname)).size
    const ebi = new Map<string, number>()
    for (const item of data.items) {
      if (item.severity === 'Critical' && item.external_ip) {
        ebi.set(item.instance_name, (ebi.get(item.instance_name) ?? 0) + 1)
      }
    }
    return { totalCritical: tc, exposedCritical: ec, exposedHosts: eh, exposedByInstance: ebi }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Loading vulnerability data from all instances...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-red-700 dark:text-red-400">{error}</div>
  }

  if (!data) return null

  // CSV data for flat table
  const csvData = filtered.slice(0, 5000).map(item => ({
    instance: item.instance_name,
    severity: item.severity,
    cve: item.vuln_id,
    package: item.package ?? '',
    version: item.version ?? '',
    fix_version: item.fix_version ?? '',
    hostname: item.hostname ?? '',
    external_ip: item.external_ip ?? '',
    instance_id: item.instance_id_tag ?? '',
  }))

  // CSV data for package summary
  const csvPackages = sortedPackages.map(p => ({
    package: p.package,
    severity: p.severity,
    cve_count: p.cves.size,
    cves: [...p.cves].join('; '),
    current_versions: [...p.versions].join('; '),
    fix_versions: [...p.fix_versions].join('; '),
    affected_hosts: p.hosts.size,
    hostnames: [...p.hosts].join('; '),
    instances: [...p.instances].join('; '),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vulnerabilities</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Host vulnerabilities across all instances (last 24 hours)
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

      {/* Quick stats banner */}
      <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex items-center gap-6">
        <Globe className="h-8 w-8 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        <div>
          <p className="text-sm text-gray-900 dark:text-white font-medium">
            {exposedCritical.toLocaleString()} critical internet-exposed vulnerabilities on {exposedHosts} host{exposedHosts !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {totalCritical.toLocaleString()} critical total across {data.instances.length} instances &middot; {(totalCritical - exposedCritical).toLocaleString()} internal only
          </p>
        </div>
      </div>

      {/* Per-instance summary cards */}
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
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{(exposedByInstance.get(inst.instance_name) ?? 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Exposed &middot; {inst.critical_count.toLocaleString()} critical total
                </p>
              </div>
              <Bug className="h-8 w-8 text-blue-300 dark:text-blue-500/30" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter toggles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSeverityFilter(severityFilter === 'Critical' ? 'all' : 'Critical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              severityFilter === 'Critical'
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
          >
            Critical Only
          </button>
          <button
            onClick={() => setInternetExposed(!internetExposed)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              internetExposed
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
          >
            <Globe className="h-3 w-3" />
            Internet Exposed
          </button>
          <button
            onClick={() => setFixableOnly(!fixableOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              fixableOnly
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
          >
            <Wrench className="h-3 w-3" />
            Fix Available
          </button>
        </div>
        {instanceFilter !== 'all' && (
          <button onClick={() => setInstanceFilter('all')} className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            Clear: {instanceFilter}
          </button>
        )}
        <span className="text-sm text-gray-400 dark:text-gray-500">
          {sortedPackages.length} packages, {filtered.length.toLocaleString()} findings
        </span>
      </div>

      {/* Package summary table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex-shrink-0">Affected Packages</h2>
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
            data={csvPackages}
            filename={`vulns-packages-${new Date().toISOString().slice(0, 10)}`}
            columns={[
              { key: 'package', label: 'Package' },
              { key: 'severity', label: 'Worst Severity' },
              { key: 'cve_count', label: 'CVE Count' },
              { key: 'cves', label: 'CVEs' },
              { key: 'current_versions', label: 'Current Versions' },
              { key: 'fix_versions', label: 'Fix Versions' },
              { key: 'affected_hosts', label: 'Affected Hosts' },
              { key: 'hostnames', label: 'Hostnames' },
              { key: 'instances', label: 'Instances' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <ResizableTable columns={[
            { key: 'package', label: 'Package', defaultWidth: 200, minWidth: 120 },
            { key: 'severity', label: 'Severity', defaultWidth: 100, minWidth: 80 },
            { key: 'cves', label: 'CVEs', defaultWidth: 70, minWidth: 50, align: 'center' },
            { key: 'current', label: 'Current Version(s)', defaultWidth: 170, minWidth: 100 },
            { key: 'fix', label: 'Fix Version(s)', defaultWidth: 170, minWidth: 100 },
            { key: 'hosts', label: 'Hosts', defaultWidth: 70, minWidth: 50, align: 'center' },
            { key: 'instances', label: 'Instances', defaultWidth: 180, minWidth: 100 },
          ]}>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {sortedPackages.slice(0, 200).map((pkg) => (
                <tr
                  key={pkg.package}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                  onClick={() => setSearch(pkg.package === 'unknown' ? '' : pkg.package)}
                >
                  <td className="px-6 py-3 text-gray-900 dark:text-white font-medium text-xs truncate">{pkg.package}</td>
                  <td className="px-6 py-3"><SeverityBadge severity={pkg.severity} /></td>
                  <td className="px-6 py-3 text-center">
                    <span className="text-gray-900 dark:text-white font-semibold">{pkg.cves.size}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs truncate">
                    {[...pkg.versions].join(', ') || '-'}
                  </td>
                  <td className="px-6 py-3 text-green-600 dark:text-green-400 font-mono text-xs truncate">
                    {[...pkg.fix_versions].join(', ') || <span className="text-gray-300 dark:text-gray-600">none</span>}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`font-semibold ${pkg.hosts.size >= 5 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      {pkg.hosts.size}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs truncate">{[...pkg.instances].join(', ')}</td>
                </tr>
              ))}
              {sortedPackages.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                  {search ? `No packages matching "${search}"` : 'No vulnerable packages found'}
                </td></tr>
              )}
            </tbody>
          </ResizableTable>
        </div>
        {sortedPackages.length > 200 && (
          <div className="px-6 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
            Showing 200 of {sortedPackages.length} packages. Use search to narrow down.
          </div>
        )}
      </div>

      {/* Detailed host-level table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Host Detail {search && <span className="text-gray-400 font-normal">- filtered by "{search}"</span>}
          </h2>
          <CsvDownloadButton
            data={csvData}
            filename={`vulns-detail-${new Date().toISOString().slice(0, 10)}`}
            columns={[
              { key: 'instance', label: 'Instance' },
              { key: 'severity', label: 'Severity' },
              { key: 'cve', label: 'CVE' },
              { key: 'package', label: 'Package' },
              { key: 'version', label: 'Version' },
              { key: 'fix_version', label: 'Fix Version' },
              { key: 'hostname', label: 'Hostname' },
              { key: 'external_ip', label: 'External IP' },
              { key: 'instance_id', label: 'Instance ID' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <ResizableTable columns={[
            { key: 'instance', label: 'Instance', defaultWidth: 160, minWidth: 100 },
            { key: 'severity', label: 'Severity', defaultWidth: 100, minWidth: 80 },
            { key: 'cve', label: 'CVE', defaultWidth: 170, minWidth: 100 },
            { key: 'package', label: 'Package', defaultWidth: 170, minWidth: 100 },
            { key: 'version', label: 'Version', defaultWidth: 120, minWidth: 80 },
            { key: 'fix', label: 'Fix', defaultWidth: 120, minWidth: 80 },
            { key: 'hostname', label: 'Hostname', defaultWidth: 190, minWidth: 100 },
            { key: 'external_ip', label: 'External IP', defaultWidth: 140, minWidth: 90 },
          ]}>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.slice(0, 500).map((item, i) => (
                <tr key={`${item.instance_name}-${item.vuln_id}-${item.hostname}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300 truncate">{item.instance_name}</td>
                  <td className="px-6 py-3"><SeverityBadge severity={item.severity} /></td>
                  <td className="px-6 py-3 text-gray-900 dark:text-white font-mono text-xs truncate">{item.vuln_id}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300 text-xs truncate">{item.package ?? '-'}</td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs truncate">{item.version ?? '-'}</td>
                  <td className="px-6 py-3 text-green-600 dark:text-green-400 font-mono text-xs truncate">{item.fix_version ?? <span className="text-gray-300 dark:text-gray-600">none</span>}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300 text-xs truncate font-mono" title={item.hostname ?? ''}>{item.hostname ?? '-'}</td>
                  <td className="px-6 py-3 text-xs font-mono truncate">
                    {item.external_ip
                      ? <span className="text-red-600 dark:text-red-400">{item.external_ip}</span>
                      : <span className="text-gray-300 dark:text-gray-600">internal</span>
                    }
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                  {search ? `No vulnerabilities matching "${search}"` : 'No vulnerabilities match current filters'}
                </td></tr>
              )}
            </tbody>
          </ResizableTable>
        </div>
        {filtered.length > 500 && (
          <div className="px-6 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
            Showing 500 of {filtered.length.toLocaleString()} results. Use search to narrow down.
          </div>
        )}
      </div>
    </div>
  )
}
