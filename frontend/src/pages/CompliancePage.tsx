import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldAlert, RefreshCw, Loader2, Search } from 'lucide-react'
import { getCompliance } from '../api/compliance'
import SeverityBadge from '../components/SeverityBadge'
import CsvDownloadButton from '../components/CsvDownload'
import ResizableTable from '../components/ResizableTable'
import type { CompliancePageData } from '../types'

export default function CompliancePage() {
  const [data, setData] = useState<CompliancePageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [instanceFilter, setInstanceFilter] = useState<string>('all')

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const result = await getCompliance()
      setData(result)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to load compliance data')
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
    return data.items.filter((item) => {
      const matchesSearch = !q ||
        [item.title, item.resource, item.reason, item.section, item.instance_name, item.dataset, item.region, item.account]
          .some(v => v?.toLowerCase().includes(q))
      const matchesInstance = instanceFilter === 'all' || item.instance_name === instanceFilter
      return matchesSearch && matchesInstance
    })
  }, [data, q, instanceFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Loading compliance data...</p>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Non-compliant policies across all instances (last 24 hours)
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
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{inst.critical_count}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Non-compliant policies</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-blue-300 dark:text-blue-500/30" />
            </div>
            <div className="flex gap-1.5 mt-3">
              {inst.datasets.map((ds) => (
                <span key={ds} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                  {ds.replace('Compliance', '')}
                </span>
              ))}
            </div>
          </div>
        ))}
        {data.instances.length === 0 && (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
            No compliance data available
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex-shrink-0">Non-Compliant Policies ({filtered.length})</h2>
          {instanceFilter !== 'all' && (
            <button
              onClick={() => setInstanceFilter('all')}
              className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0"
            >
              Clear filter: {instanceFilter}
            </button>
          )}
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
            data={filtered.map(item => ({
              instance: item.instance_name,
              severity: item.severity,
              cloud: item.dataset.replace('Compliance', ''),
              section: item.section ?? '',
              title: item.title,
              resource: item.resource ?? '',
              region: item.region ?? '',
              account: item.account ?? '',
              reason: item.reason ?? '',
            }))}
            filename={`compliance-critical-${new Date().toISOString().slice(0, 10)}`}
          />
        </div>
        <div className="overflow-x-auto">
          <ResizableTable columns={[
            { key: 'instance', label: 'Instance', defaultWidth: 160, minWidth: 100 },
            { key: 'severity', label: 'Severity', defaultWidth: 100, minWidth: 80 },
            { key: 'cloud', label: 'Cloud', defaultWidth: 100, minWidth: 70 },
            { key: 'section', label: 'Section', defaultWidth: 140, minWidth: 80 },
            { key: 'title', label: 'Title', defaultWidth: 300, minWidth: 150 },
            { key: 'resource', label: 'Resource', defaultWidth: 220, minWidth: 100 },
            { key: 'region', label: 'Region', defaultWidth: 130, minWidth: 80 },
            { key: 'reason', label: 'Reason', defaultWidth: 260, minWidth: 120 },
          ]}>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.slice(0, 200).map((item, i) => (
                <tr key={`${item.instance_name}-${item.resource}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-3 text-gray-600 dark:text-gray-300 truncate">{item.instance_name}</td>
                  <td className="px-6 py-3"><SeverityBadge severity={item.severity} /></td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs truncate">{item.dataset.replace('Compliance', '')}</td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs truncate">{item.section ?? '-'}</td>
                  <td className="px-6 py-3 text-gray-900 dark:text-white truncate" title={item.title}>{item.title}</td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs truncate font-mono" title={item.resource ?? ''}>{item.resource ?? '-'}</td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs truncate">{item.region ?? '-'}</td>
                  <td className="px-6 py-3 text-gray-400 dark:text-gray-500 text-xs truncate" title={item.reason ?? ''}>{item.reason ?? '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                  {search ? `No compliance issues matching "${search}"` : 'No matching compliance issues'}
                </td></tr>
              )}
            </tbody>
          </ResizableTable>
        </div>
        {filtered.length > 200 && (
          <div className="px-6 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
            Showing 200 of {filtered.length} results. Use search to narrow down.
          </div>
        )}
      </div>
    </div>
  )
}
