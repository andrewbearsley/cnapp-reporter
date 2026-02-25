import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, HeartPulse, RefreshCw, Server } from 'lucide-react'
import { listInstances, createInstance, updateInstance, deleteInstance, testInstanceConnection, syncInstance } from '../api/instances'
import InstanceForm from '../components/InstanceForm'
import StatusBadge from '../components/StatusBadge'
import type { Instance, InstanceCreate } from '../types'

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editInstance, setEditInstance] = useState<Instance | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({})
  const [syncResults, setSyncResults] = useState<Record<number, { success: boolean; alerts: number; host_vulns: number; compliance: number; error: string | null }>>({})

  const fetchInstances = useCallback(async () => {
    try {
      const data = await listInstances()
      setInstances(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  async function handleCreate(data: InstanceCreate) {
    await createInstance(data)
    await fetchInstances()
  }

  async function handleUpdate(data: InstanceCreate) {
    if (!editInstance) return
    await updateInstance(editInstance.id, data)
    await fetchInstances()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this instance? This cannot be undone.')) return
    await deleteInstance(id)
    await fetchInstances()
  }

  async function handleTest(id: number) {
    setTestingId(id)
    try {
      const result = await testInstanceConnection(id)
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: err.response?.data?.detail ?? err.message },
      }))
    } finally {
      setTestingId(null)
    }
  }

  async function handleSync(id: number) {
    setSyncingId(id)
    setSyncResults((prev) => { const next = { ...prev }; delete next[id]; return next })
    try {
      const result = await syncInstance(id)
      setSyncResults((prev) => ({ ...prev, [id]: result }))
      await fetchInstances()
    } catch (err: any) {
      setSyncResults((prev) => ({
        ...prev,
        [id]: { success: false, alerts: 0, host_vulns: 0, compliance: 0, error: err.response?.data?.detail ?? err.message },
      }))
    } finally {
      setSyncingId(null)
    }
  }

  async function handleToggle(inst: Instance) {
    await updateInstance(inst.id, { is_enabled: !inst.is_enabled } as any)
    await fetchInstances()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instances</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your CNAPP tenant connections</p>
        </div>
        <button
          onClick={() => { setEditInstance(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Add Instance
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Server className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No instances configured</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Add your first CNAPP instance to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Instance
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {instances.map((inst) => (
            <div key={inst.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2.5 ${inst.is_enabled ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}`}>
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{inst.name}</h3>
                      <StatusBadge status={inst.last_sync_status ?? 'pending'} />
                      {!inst.is_enabled && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Disabled</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">{inst.base_url}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>Key: {inst.api_key_id.substring(0, 16)}...</span>
                      {inst.email && <span>Contact: {inst.email}</span>}
                      {inst.sub_account && <span>Sub-account: {inst.sub_account}</span>}
                      {inst.last_sync_at && (
                        <span>Last sync: {new Date(inst.last_sync_at).toLocaleString()}</span>
                      )}
                    </div>
                    {inst.last_error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xl truncate">Error: {inst.last_error}</p>
                    )}
                    {testResults[inst.id] && (
                      <p className={`text-xs mt-1 ${testResults[inst.id].success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {testResults[inst.id].success ? 'Connection successful' : `Failed: ${testResults[inst.id].message}`}
                      </p>
                    )}
                    {syncResults[inst.id] && (
                      <p className={`text-xs mt-1 ${syncResults[inst.id].success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {syncResults[inst.id].success
                          ? `Synced: ${syncResults[inst.id].alerts} alerts, ${syncResults[inst.id].host_vulns} vulns, ${syncResults[inst.id].compliance} compliance`
                          : `Sync failed: ${syncResults[inst.id].error}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(inst.id)}
                    disabled={testingId === inst.id}
                    title="Test connection"
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    {testingId === inst.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : testResults[inst.id]?.success ? (
                      <HeartPulse className="h-4 w-4 text-green-500 dark:text-green-400" />
                    ) : (
                      <HeartPulse className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSync(inst.id)}
                    disabled={syncingId === inst.id}
                    title="Refresh data"
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    {syncingId === inst.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className={`h-4 w-4 ${syncResults[inst.id]?.success ? 'text-green-500 dark:text-green-400' : ''}`} />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(inst)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      inst.is_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    title={inst.is_enabled ? 'Disable' : 'Enable'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        inst.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => { setEditInstance(inst); setShowForm(true) }}
                    title="Edit"
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(inst.id)}
                    title="Delete"
                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <InstanceForm
          instance={editInstance}
          onSubmit={editInstance ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditInstance(null) }}
        />
      )}
    </div>
  )
}
