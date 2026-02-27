import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Server, Settings, LogOut, Shield, ShieldAlert, Bug, AlertTriangle, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts', icon: AlertTriangle, label: 'Alerts' },
  { to: '/compliance', icon: ShieldAlert, label: 'Compliance' },
  { to: '/identities', icon: Users, label: 'Identities' },
  { to: '/vulnerabilities', icon: Bug, label: 'Vulnerabilities' },
  { to: '/instances', icon: Server, label: 'Instances' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const { logout } = useAuth()

  return (
    <div className="flex h-full">
      {/* Sidebar - always dark */}
      <aside className="w-64 bg-navy-950 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-800">
          <Shield className="h-8 w-8 text-green-500" />
          <h1 className="text-base leading-tight"><span className="font-bold text-white">CNAPP</span> <span className="text-navy-300">Reporter</span></h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-navy-800 text-white border-l-3 border-red-500'
                    : 'text-navy-300 hover:bg-navy-900 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: logout */}
        <div className="px-3 py-4 border-t border-navy-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-300 hover:bg-navy-900 hover:text-white w-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-gray-900 p-8">
        <Outlet />
      </main>
    </div>
  )
}
