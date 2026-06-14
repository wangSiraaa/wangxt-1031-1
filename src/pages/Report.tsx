import { useEffect, useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { useStore } from '@/store'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'
import type { IssueSeverity, IssueStatus } from '@/types'

const STATUS_COLORS: Record<IssueStatus, string> = {
  submitted: 'bg-zinc-400',
  assigned: 'bg-zinc-500',
  plan_submitted: 'bg-blue-400',
  in_remediation: 'bg-amber-400',
  reinspection_in_progress: 'bg-purple-400',
  reinspection_passed: 'bg-teal-400',
  overdue: 'bg-rose-500',
  reopened: 'bg-orange-400',
  closed: 'bg-emerald-500',
}

const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

export default function Report() {
  const { issues, riskScores, riskDeductions, loading, fetchIssues, fetchRisk } = useStore()

  useEffect(() => {
    fetchIssues()
    fetchRisk()
  }, [fetchIssues, fetchRisk])

  const total = issues.length
  const closedCount = issues.filter((i) => i.status === 'closed').length
  const closeRate = total > 0 ? ((closedCount / total) * 100).toFixed(1) : '0.0'
  const highCount = issues.filter((i) => i.severity === 'high').length
  const score = riskScores[0]?.score ?? 0
  const scoreColor = score < -50 ? 'text-rose-600' : score < -20 ? 'text-amber-600' : 'text-emerald-600'

  const statusDist = useMemo(() => {
    const map = new Map<IssueStatus, number>()
    issues.forEach((i) => map.set(i.status, (map.get(i.status) ?? 0) + 1))
    return Array.from(map.entries())
  }, [issues])

  const severityDist = useMemo(() => {
    const map = new Map<IssueSeverity, number>()
    issues.forEach((i) => map.set(i.severity, (map.get(i.severity) ?? 0) + 1))
    return (['high', 'medium', 'low'] as IssueSeverity[]).map((s) => ({
      severity: s,
      count: map.get(s) ?? 0,
    }))
  }, [issues])

  const sortedDeductions = useMemo(
    () => [...riskDeductions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [riskDeductions]
  )

  const maxStatusCount = Math.max(...statusDist.map(([, c]) => c), 1)
  const maxSevCount = Math.max(...severityDist.map((s) => s.count), 1)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={22} className="text-zinc-700" />
        <h1 className="text-xl font-semibold text-zinc-900">整改闭环报表</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-zinc-800">{total}</p>
          <p className="text-sm text-zinc-500 mt-1">总问题数</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{closeRate}%</p>
          <p className="text-sm text-emerald-600 mt-1">闭环率</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-zinc-800">
            {highCount}
            <span className="ml-1 bg-rose-500 text-white text-xs rounded-full px-1.5 py-0.5 align-middle">高</span>
          </p>
          <p className="text-sm text-zinc-500 mt-1">高风险问题数</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${scoreColor}`}>{score}</p>
          <p className="text-sm text-zinc-500 mt-1">风险评分</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-700">状态分布</h2>
        <div className="space-y-1.5">
          {statusDist.map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <span className="w-24 text-xs text-zinc-600 text-right shrink-0">{STATUS_LABELS[status]}</span>
              <div className="flex-1 bg-zinc-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`${STATUS_COLORS[status]} h-full rounded-full flex items-center justify-end pr-2 transition-all`}
                  style={{ width: `${(count / maxStatusCount) * 100}%`, minWidth: count > 0 ? '2rem' : '0' }}
                >
                  <span className="text-xs text-white font-medium">{count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-700">级别分布</h2>
        <div className="space-y-1.5">
          {severityDist.map(({ severity, count }) => (
            <div key={severity} className="flex items-center gap-2">
              <span className="w-24 text-xs text-zinc-600 text-right shrink-0">{SEVERITY_LABELS[severity]}</span>
              <div className="flex-1 bg-zinc-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`${SEVERITY_COLORS[severity]} h-full rounded-full flex items-center justify-end pr-2 transition-all`}
                  style={{ width: `${(count / maxSevCount) * 100}%`, minWidth: count > 0 ? '2rem' : '0' }}
                >
                  <span className="text-xs text-white font-medium">{count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-700">风险扣分记录</h2>
        {loading ? (
          <div className="text-center py-8 text-zinc-400">加载中...</div>
        ) : (
          <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
            {sortedDeductions.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-500">{d.issueId.slice(-4).toUpperCase()}</span>
                  <span className="text-sm text-zinc-700">{d.reason}</span>
                </div>
                <span className="text-sm font-semibold text-rose-600">-{d.points}</span>
              </div>
            ))}
            {sortedDeductions.length === 0 && (
              <div className="text-center py-8 text-zinc-400">暂无扣分记录</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
