import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, AlertTriangle, ClipboardList, UserCheck, Eye, Stamp, BarChart3 } from 'lucide-react'
import { useStore } from '@/store'
import { SEVERITY_LABELS, STATUS_LABELS } from '@/types'
import type { IssueSeverity, IssueStatus } from '@/types'

const SEVERITY_BG: Record<IssueSeverity, string> = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-blue-500' }
const STATUS_BG: Record<string, string> = {
  overdue: 'bg-rose-100 text-rose-700',
  closed: 'bg-emerald-100 text-emerald-700',
  plan_submitted: 'bg-amber-100 text-amber-700',
  in_remediation: 'bg-blue-100 text-blue-700',
  reinspection_in_progress: 'bg-purple-100 text-purple-700',
  reinspection_passed: 'bg-emerald-100 text-emerald-700',
}

export default function Home() {
  const { issues, riskScores, currentUser, fetchIssues, fetchRisk } = useStore()

  useEffect(() => {
    fetchIssues()
    fetchRisk()
  }, [fetchIssues, fetchRisk])

  const total = issues.length
  const closed = issues.filter((i) => i.status === 'closed').length
  const overdue = issues.filter((i) => i.isOverdue).length
  const highSeverity = issues.filter((i) => i.severity === 'high').length
  const closeRate = total > 0 ? Math.round((closed / total) * 100) : 0
  const riskScore = riskScores.length > 0 ? riskScores[0].score : 0

  const pendingByRole =
    currentUser.role === 'auditor'
      ? issues.filter((i) => i.status === 'submitted').length
      : currentUser.role === 'responsible'
        ? issues.filter((i) => i.status === 'assigned' || i.status === 'plan_submitted').length
        : currentUser.role === 'safety'
          ? issues.filter((i) => i.status === 'in_remediation' || i.status === 'reinspection_in_progress').length
          : issues.filter((i) => i.status === 'plan_submitted').length

  const roleAction =
    currentUser.role === 'auditor'
      ? { label: '提交问题', path: '/issues/new', icon: ClipboardList }
      : currentUser.role === 'responsible'
        ? { label: '处理分派', path: '/assignment', icon: UserCheck }
        : currentUser.role === 'safety'
          ? { label: '安全复查', path: '/reinspection', icon: Eye }
          : { label: '审批管理', path: '/approval', icon: Stamp }

  const statusCounts = Object.entries(STATUS_LABELS).reduce<Record<string, number>>((acc, [key]) => {
    acc[key] = issues.filter((i) => i.status === key).length
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">安环整改闭环管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            欢迎回来，{currentUser.name}（{currentUser.role === 'auditor' ? '审厂员' : currentUser.role === 'responsible' ? '企业负责人' : currentUser.role === 'safety' ? '安全专员' : '主管'}）
          </p>
        </div>
        <Link
          to={roleAction.path}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition shadow-sm"
        >
          <roleAction.icon size={18} />
          {roleAction.label}
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <ClipboardList size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">总问题数</p>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Shield size={20} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">闭环率</p>
              <p className="text-2xl font-bold text-emerald-600">{closeRate}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-rose-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">逾期问题</p>
              <p className="text-2xl font-bold text-rose-600">{overdue}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <BarChart3 size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">风险评分</p>
              <p className={`text-2xl font-bold ${riskScore < -50 ? 'text-rose-600' : riskScore < -20 ? 'text-amber-600' : 'text-emerald-600'}`}>{riskScore}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">问题状态分布</h2>
          <div className="space-y-2">
            {Object.entries(statusCounts)
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-20 truncate">{STATUS_LABELS[status as IssueStatus]}</span>
                  <div className="flex-1 bg-zinc-100 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATUS_BG[status] || 'bg-zinc-200'}`}
                      style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, minWidth: count > 0 ? '20px' : '0' }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">风险分级</h2>
          <div className="space-y-3">
            {(['high', 'medium', 'low'] as IssueSeverity[]).map((sev) => {
              const count = issues.filter((i) => i.severity === sev).length
              return (
                <div key={sev} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`${SEVERITY_BG[sev]} text-white text-xs px-2 py-0.5 rounded-full`}>{SEVERITY_LABELS[sev]}</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{count}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">待处理事项</span>
              <span className="text-lg font-bold text-amber-600">{pendingByRole}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">近期问题</h2>
        <div className="space-y-2">
          {issues.slice(0, 5).map((issue) => (
            <Link key={issue.id} to={`/issues/${issue.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 transition">
              <div className="flex items-center gap-3">
                <span className={`${SEVERITY_BG[issue.severity]} text-white text-xs px-2 py-0.5 rounded-full`}>{SEVERITY_LABELS[issue.severity]}</span>
                <span className="text-sm font-medium text-slate-700">{issue.id}</span>
                <span className="text-sm text-zinc-600">{issue.title}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BG[issue.status] || 'bg-zinc-100 text-zinc-600'}`}>{STATUS_LABELS[issue.status]}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
