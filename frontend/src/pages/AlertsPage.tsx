import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Search } from 'lucide-react'
import { getAlerts } from '../api/alerts'
import SeverityBadge from '../components/SeverityBadge'
import CsvDownloadButton from '../components/CsvDownload'
import ResizableTable from '../components/ResizableTable'
import type { AlertPageData } from '../types'

export default function AlertsPage() {
  const [data, setData] = useState<AlertPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [instanceFilter, setInstanceFilter] = useState<string>('all')

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const result = await getAlerts()
      setData(result)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to load alerts')
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
    return data.items.filter(alert => {
      const matchesSearch = !q ||
        [alert.instance_name, alert.severity, alert.category, alert.title, alert.alert_type, alert.description, alert.status]
          .some(v => v?.toLowerCase().includes(q))
      const matchesInstance = instanceFilter === 'all' || alert.instance_name === instanceFilter
      return matchesSearch && matchesInstance
    })
  }, [data, q, instanceFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Composite alerts across all instances (90-day lookback)
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
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{inst.instance_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {inst.alert_count} alert{inst.alert_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {inst.alert_count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex-shrink-0">
            All Alerts ({filtered.length})
          </h2>
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
            data={filtered.map(a => ({
              instance: a.instance_name,
              severity: a.severity,
              category: a.category ?? '',
              alert_type: a.alert_type,
              alert_id: a.alert_id,
              title: a.title,
              status: a.status,
              time: a.created_time,
              description: a.description ?? '',
            }))}
            filename={`alerts-${new Date().toISOString().slice(0, 10)}`}
          />
        </div>

        <div className="overflow-x-auto">
          <ResizableTable columns={[
            { key: 'instance', label: 'Instance', defaultWidth: 160, minWidth: 100 },
            { key: 'severity', label: 'Severity', defaultWidth: 100, minWidth: 80 },
            { key: 'category', label: 'Category', defaultWidth: 140, minWidth: 80 },
            { key: 'type', label: 'Type', defaultWidth: 220, minWidth: 120 },
            { key: 'title', label: 'Title', defaultWidth: 320, minWidth: 150 },
            { key: 'status', label: 'Status', defaultWidth: 90, minWidth: 60 },
            { key: 'time', label: 'Time', defaultWidth: 180, minWidth: 120 },
          ]}>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.map((alert, i) => (
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
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs truncate" title={alert.alert_type}>{alert.alert_type}</td>
                  <td className="px-6 py-3 text-gray-900 dark:text-white truncate" title={alert.description ?? alert.title}>{alert.title}</td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 truncate">{alert.status}</td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                    {alert.created_time ? new Date(alert.created_time).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                    {search ? `No alerts matching "${search}"` : 'No composite alerts found. Adjust the severity filter in Settings if needed.'}
                  </td>
                </tr>
              )}
            </tbody>
          </ResizableTable>
        </div>
      </div>
    </div>
  )
}
