import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useStore } from '@/store'
import type { IssueSeverity, IssueStatus } from '@/types'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部级别' },
  ...Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label })),
]

const SEVERITY_BG: Record<IssueSeverity, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

const STATUS_BG: Record<IssueStatus, string> = {
  overdue: 'bg-rose-100 text-rose-700',
  closed: 'bg-emerald-100 text-emerald-700',
  submitted: 'bg-zinc-100 text-zinc-700',
  assigned: 'bg-zinc-100 text-zinc-700',
  plan_submitted: 'bg-zinc-100 text-zinc-700',
  in_remediation: 'bg-zinc-100 text-zinc-700',
  reinspection_in_progress: 'bg-zinc-100 text-zinc-700',
  reinspection_passed: 'bg-zinc-100 text-zinc-700',
  reopened: 'bg-zinc-100 text-zinc-700',
}

export default function Issues() {
  const navigate = useNavigate()
  const { issues, loading, fetchIssues } = useStore()
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (severity) params.severity = severity
    if (search) params.search = search
    fetchIssues(params)
  }, [status, severity, search, fetchIssues])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">审厂问题</h1>
        <button
          onClick={() => navigate('/issues/new')}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          提交问题
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题或编号"
            className="w-full border border-zinc-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">加载中...</div>
      ) : (
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">编号</th>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">法规条款</th>
                <th className="px-4 py-3 font-medium">级别</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">截止日</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, i) => (
                <tr
                  key={issue.id}
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  className={`border-t border-zinc-100 cursor-pointer hover:bg-zinc-50 transition-colors ${
                    issue.isOverdue ? 'bg-rose-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-zinc-900 font-mono">
                    {issue.id}
                  </td>
                  <td className="px-4 py-3 text-zinc-900">{issue.title}</td>
                  <td className="px-4 py-3 text-zinc-600">{issue.regulationClause}</td>
                  <td className="px-4 py-3">
                    <span className={`${SEVERITY_BG[issue.severity]} text-white rounded-full px-2 py-0.5 text-xs`}>
                      {SEVERITY_LABELS[issue.severity]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`${STATUS_BG[issue.status]} rounded-full px-2 py-0.5 text-xs`}>
                      {STATUS_LABELS[issue.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{new Date(issue.deadline).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/issues/${issue.id}`)
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
              {issues.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-400">暂无数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
