import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/store'
import { SEVERITY_LABELS } from '@/types'
import type { IssueSeverity } from '@/types'

const SEVERITY_BG: Record<IssueSeverity, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

export default function Overdue() {
  const { issues, riskDeductions, loading, fetchIssues, fetchRisk } = useStore()

  useEffect(() => {
    fetchIssues({ overdue: 'true' })
    fetchRisk()
  }, [fetchIssues, fetchRisk])

  const overdueIssues = issues.filter((i) => i.isOverdue)
  const highCount = overdueIssues.filter((i) => i.severity === 'high').length
  const totalDeduction = riskDeductions.reduce((s, d) => s + d.points, 0)

  const overdueDays = (deadline: string) =>
    Math.floor((Date.now() - new Date(deadline).getTime()) / 86400000)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={22} className="text-rose-600" />
        <h1 className="text-xl font-semibold text-rose-700">逾期红榜</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-rose-700">{overdueIssues.length}</p>
          <p className="text-sm text-rose-600 mt-1">逾期问题总数</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-rose-700">{highCount}</p>
          <p className="text-sm text-rose-600 mt-1">高风险逾期数</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-rose-700">{totalDeduction}</p>
          <p className="text-sm text-rose-600 mt-1">风险扣分总计</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">加载中...</div>
      ) : (
        <div className="border border-rose-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-rose-100 text-left text-rose-700">
                <th className="px-4 py-3 font-medium">编号</th>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">级别</th>
                <th className="px-4 py-3 font-medium">逾期天数</th>
                <th className="px-4 py-3 font-medium">风险扣分</th>
                <th className="px-4 py-3 font-medium">截止日期</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {overdueIssues.map((issue, i) => (
                <tr key={issue.id} className="border-t border-rose-100 bg-rose-50">
                  <td className="px-4 py-3 text-zinc-900 font-mono">
                    {String(i + 1).padStart(3, '0')}
                  </td>
                  <td className="px-4 py-3 text-zinc-900">{issue.title}</td>
                  <td className="px-4 py-3">
                    <span className={`${SEVERITY_BG[issue.severity]} text-white rounded-full px-2 py-0.5 text-xs`}>
                      {SEVERITY_LABELS[issue.severity]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-rose-600">
                    {overdueDays(issue.deadline)}天
                  </td>
                  <td className="px-4 py-3 text-rose-700">{issue.riskScoreDeduction}</td>
                  <td className="px-4 py-3 text-zinc-600">{issue.deadline}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/issues/${issue.id}`}
                      className="text-rose-600 hover:text-rose-800 text-xs"
                    >
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
              {overdueIssues.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-400">暂无逾期数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
