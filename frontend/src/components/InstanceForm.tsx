import { useState } from 'react'
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { Instance, InstanceCreate } from '../types'
import { testNewConnection } from '../api/instances'

interface InstanceFormProps {
  instance?: Instance | null
  onSubmit: (data: InstanceCreate) => Promise<void>
  onClose: () => void
}

export default function InstanceForm({ instance, onSubmit, onClose }: InstanceFormProps) {
  const [form, setForm] = useState<InstanceCreate>({
    name: instance?.name ?? '',
    account: instance?.account ?? '',
    api_key_id: instance?.api_key_id ?? '',
    api_secret: '',
    sub_account: instance?.sub_account ?? '',
    email: instance?.email ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState('')

  const isEdit = !!instance

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testNewConnection({
        ...form,
        api_secret: form.api_secret || 'placeholder',
      })
      setTestResult(result)
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.detail ?? err.message })
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = { ...form }
      if (isEdit && !payload.api_secret) {
        const { api_secret: _, ...rest } = payload as any
        await onSubmit(rest)
      } else {
        await onSubmit(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Instance' : 'Add Instance'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Name / Label</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Production-AWS"
              className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Account</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                placeholder="your-account"
                className="flex-1 rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="text-gray-500 dark:text-gray-400 text-sm">.lacework.net</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">API Key ID</label>
            <input
              type="text"
              required={!isEdit}
              value={form.api_key_id}
              onChange={(e) => setForm({ ...form, api_key_id: e.target.value })}
              placeholder="ACCOUNT_XXXXXXXXXX..."
              className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              API Secret {isEdit && <span className="text-gray-400 dark:text-gray-500">(leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              required={!isEdit}
              value={form.api_secret}
              onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
              placeholder={isEdit ? '********' : 'Enter API secret'}
              className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Sub-Account (optional)</label>
            <input
              type="text"
              value={form.sub_account ?? ''}
              onChange={(e) => setForm({ ...form, sub_account: e.target.value })}
              placeholder="Optional sub-account name"
              className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Contact Email (optional)</label>
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@example.com"
              className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Test connection */}
          {testResult && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.message}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.account || !form.api_key_id || (!form.api_secret && !isEdit)}
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-gray-400 dark:disabled:text-gray-600 flex items-center gap-1.5"
            >
              {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Test Connection
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? 'Update' : 'Add Instance'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
