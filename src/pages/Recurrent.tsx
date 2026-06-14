import { useEffect, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { useStore } from '@/store'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'
import type { Issue, IssueSeverity } from '@/types'

const SEVERITY_BG: Record<IssueSeverity, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

export default function Recurrent() {
  const { issues, riskDeductions, currentUser, loading, fetchIssues, fetchRisk, reopenIssue } = useStore()

  useEffect(() => {
    fetchIssues()
    fetchRisk()
  }, [fetchIssues, fetchRisk])

  const recurrentIssues = issues.filter((i) => i.isRecurrent)
  const uniqueOriginals = new Set(recurrentIssues.map((i) => i.originalIssueId)).size
  const extraDeduction = riskDeductions
    .filter((d) => recurrentIssues.some((ri) => ri.id === d.issueId))
    .reduce((s, d) => s + d.points, 0)

  const groups = useMemo(() => {
    const map = new Map<string, Issue[]>()
    recurrentIssues.forEach((issue) => {
      const key = issue.originalIssueId ?? 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(issue)
    })
    return map
  }, [recurrentIssues])

  const findOriginal = (id: string | null): Issue | undefined =>
    id ? issues.find((i) => i.id === id) : undefined

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCw size={22} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-zinc-900">重复问题分析</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{recurrentIssues.length}</p>
          <p className="text-sm text-blue-600 mt-1">重复问题总数</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{uniqueOriginals}</p>
          <p className="text-sm text-blue-600 mt-1">原始问题数</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{extraDeduction}</p>
          <p className="text-sm text-blue-600 mt-1">额外风险扣分</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">加载中...</div>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([originalId, items]) => {
            const original = findOriginal(originalId)
            return (
              <div key={originalId} className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-200">
                  <span className="text-sm font-semibold text-blue-800">
                    原始问题 {originalId.slice(-4).toUpperCase()}
                    {original ? ` — ${original.title}` : ''}
                  </span>
                </div>
                <div className="divide-y divide-blue-100">
                  {items.map((issue) => (
                    <div key={issue.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`${SEVERITY_BG[issue.severity]} text-white rounded-full px-2 py-0.5 text-xs`}>
                          {SEVERITY_LABELS[issue.severity]}
                        </span>
                        <span className="text-sm text-zinc-700">{issue.title}</span>
                        <span className="text-xs text-zinc-400">{issue.createdAt}</span>
                        <span className="bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-xs">
                          {STATUS_LABELS[issue.status]}
                        </span>
                      </div>
                      {issue.status === 'closed' && (
                        <button
                          onClick={() => reopenIssue(issue.id, originalId, currentUser.id)}
                          className="text-xs bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600 transition-colors"
                        >
                          重开问题
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {groups.size === 0 && (
            <div className="text-center py-12 text-zinc-400">暂无重复问题</div>
          )}
        </div>
      )}
    </div>
  )
}
