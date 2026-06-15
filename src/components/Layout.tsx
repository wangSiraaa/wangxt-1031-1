import { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  ClipboardList,
  UserCheck,
  Eye,
  Stamp,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useStore } from '@/store'
import { ROLE_LABELS } from '@/types'

const NAV_ITEMS = [
  { label: '仪表盘', icon: LayoutDashboard, path: '/' },
  { label: '审厂问题', icon: ClipboardList, path: '/issues' },
  { label: '负责人分派', icon: UserCheck, path: '/assignment' },
  { label: '安全复查', icon: Eye, path: '/reinspection' },
  { label: '主管审批', icon: Stamp, path: '/approval' },
  { label: '逾期红榜', icon: AlertTriangle, path: '/overdue' },
  { label: '重复问题', icon: RefreshCw, path: '/recurrent' },
  { label: '整改报表', icon: BarChart3, path: '/report' },
]

export default function Layout() {
  const location = useLocation()
  const currentUser = useStore((s) => s.currentUser)
  const users = useStore((s) => s.users)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const isSupervisor = currentUser.role === 'supervisor'

  const navItems = [
    { label: '仪表盘', icon: LayoutDashboard, path: '/' },
    { label: '审厂问题', icon: ClipboardList, path: '/issues' },
    { label: '负责人分派', icon: UserCheck, path: '/assignment' },
    { label: '安全复查', icon: Eye, path: '/reinspection' },
    ...(isSupervisor ? [{ label: '主管审批', icon: Stamp, path: '/approval' }] : []),
    { label: '逾期红榜', icon: AlertTriangle, path: '/overdue' },
    { label: '重复问题', icon: RefreshCw, path: '/recurrent' },
    { label: '整改报表', icon: BarChart3, path: '/report' },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 text-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <Shield className="h-7 w-7 text-amber-400" />
          <span className="text-lg font-bold tracking-wide">安环整改闭环</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-l-4 border-amber-500 bg-amber-50 text-amber-700 font-medium'
                    : 'border-l-4 border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-700 p-4">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex w-full items-center justify-between rounded-lg bg-slate-800 px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium text-white">{currentUser.name}</span>
                <span className="text-xs text-slate-400">{ROLE_LABELS[currentUser.role]}</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg bg-slate-800 py-1 shadow-xl">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user)
                      setUserMenuOpen(false)
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-white">{user.name}</span>
                      <span className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</span>
                    </div>
                    {currentUser.id === user.id && <Check className="h-4 w-4 text-amber-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 overflow-y-auto bg-zinc-50 p-6">
        <Outlet />
      </main>
    </div>
  )
}
