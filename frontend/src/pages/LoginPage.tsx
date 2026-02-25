import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Loader2 } from 'lucide-react'
import { getAuthStatus, login, setup } from '../api/auth'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    getAuthStatus()
      .then((s) => setSetupRequired(s.setup_required))
      .catch(() => setSetupRequired(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (setupRequired && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (setupRequired && password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const token = setupRequired
        ? await setup(username, password)
        : await login(username, password)
      localStorage.setItem('token', token)
      setToken(token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  if (setupRequired === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-gray-900">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-navy-950 rounded-xl p-4 mb-4">
            <Shield className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">CNAPP Reporter</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Multi-Instance Reporter</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {setupRequired ? 'Create Admin Account' : 'Sign In'}
          </h2>

          {setupRequired && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              First time setup. Create your administrator account.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
              placeholder={setupRequired ? 'Minimum 8 characters' : 'Enter password'}
            />
          </div>

          {setupRequired && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Re-enter password"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {setupRequired ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
