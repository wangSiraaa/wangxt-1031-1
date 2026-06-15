import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, TrendingDown, BarChart3, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/store'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'
import type { Issue, IssueSeverity, RiskReevaluation, RecurrenceLink } from '@/types'
import { cn } from '@/lib/utils'

const SEVERITY_BG: Record<IssueSeverity, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

export default function Recurrent() {
  const { issues, riskDeductions, recurrenceLinks, riskReevaluations, currentUser, loading, fetchIssues, fetchRisk, reopenIssue, reevaluateRisk, fetchSimilarIssues } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchIssues()
    fetchRisk()
  }, [fetchIssues, fetchRisk])

  const recurrentIssues = issues.filter((i) => i.isRecurrent || i.recurrenceRound && i.recurrenceRound > 0)
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

  const getRecurrenceLinks = (issueId: string): RecurrenceLink[] =>
    recurrenceLinks.filter(rl => rl.issueId === issueId || rl.originalIssueId === issueId)

  const getRiskReevaluations = (issueId: string): RiskReevaluation[] =>
    riskReevaluations.filter(rr => rr.issueId === issueId)

  const getEffectivenessColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 50) return 'text-amber-600 bg-amber-100'
    return 'text-red-600 bg-red-100'
  }

  const handleReevaluateRisk = async (issueId: string) => {
    await reevaluateRisk(issueId)
    await fetchIssues()
    await fetchRisk()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCw size={22} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-zinc-900">重复问题分析</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{recurrentIssues.length}</p>
          <p className="text-sm text-blue-600 mt-1">重复问题总数</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{uniqueOriginals}</p>
          <p className="text-sm text-blue-600 mt-1">原始问题数</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{extraDeduction}</p>
          <p className="text-sm text-red-600 mt-1">额外风险扣分</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{Math.round(extraDeduction / Math.max(uniqueOriginals, 1))}</p>
          <p className="text-sm text-amber-600 mt-1">平均每例扣分</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">加载中...</div>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([originalId, items]) => {
            const original = findOriginal(originalId)
            const isExpanded = expandedId === originalId
            return (
              <div key={originalId} className="border border-amber-200 rounded-lg overflow-hidden">
                <div 
                  className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : originalId)}
                >
                  <span className="text-sm font-semibold text-amber-800">
                    原始问题 {originalId.slice(-4).toUpperCase()}
                    {original ? ` — ${original.title}` : ''}
                    <span className="ml-2 text-xs font-normal text-amber-600">（{items.length} 次复发）</span>
                  </span>
                  {isExpanded ? <ChevronUp size={18} className="text-amber-600" /> : <ChevronDown size={18} className="text-amber-600" />}
                </div>
                <div className="divide-y divide-amber-100">
                  {items.map((issue, index) => {
                    const links = getRecurrenceLinks(issue.id)
                    const reevals = getRiskReevaluations(issue.id)
                    const round = issue.recurrenceRound || index + 1
                    return (
                      <div key={issue.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-xs font-medium">
                              第 {round} 轮
                            </span>
                            <span className={`${SEVERITY_BG[issue.severity]} text-white rounded-full px-2 py-0.5 text-xs`}>
                              {SEVERITY_LABELS[issue.severity]}
                            </span>
                            <span className="text-sm text-zinc-700">{issue.title}</span>
                            <span className="text-xs text-zinc-400">{issue.createdAt}</span>
                            <span className="bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-xs">
                              {STATUS_LABELS[issue.status]}
                            </span>
                            {links.length > 0 && links[0].effectivenessScore !== undefined && (
                              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', getEffectivenessColor(links[0].effectivenessScore))}>
                                效果 {links[0].effectivenessScore}/100
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {reevals.length === 0 && issue.status !== 'closed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReevaluateRisk(issue.id) }}
                                className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors flex items-center gap-1"
                              >
                                <TrendingDown size={12} />风险重评
                              </button>
                            )}
                            {issue.status === 'closed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); reopenIssue(issue.id, originalId, currentUser.id) }}
                                className="text-xs bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600 transition-colors"
                              >
                                重开问题
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && links.length > 0 && (
                          <div className="mt-3 ml-8 border-l-2 border-amber-200 pl-4 space-y-3">
                            {links.map((link) => (
                              <div key={link.id} className="bg-amber-50 rounded-lg p-3 text-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <BarChart3 size={14} className="text-amber-600" />
                                  <span className="font-medium text-amber-800">对比分析（第 {link.recurrenceRound} 轮）</span>
                                  <span className="text-xs text-gray-500">相似度 {link.similarityScore}%</span>
                                </div>
                                <div className="text-gray-600 mb-2">{link.comparisonAnalysis}</div>
                                {link.effectivenessScore !== undefined && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-500">整改效果得分:</span>
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-32">
                                      <div 
                                        className={cn('h-2 rounded-full', link.effectivenessScore >= 80 ? 'bg-green-500' : link.effectivenessScore >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                                        style={{ width: `${link.effectivenessScore}%` }}
                                      />
                                    </div>
                                    <span className={cn('font-medium', link.effectivenessScore >= 80 ? 'text-green-600' : link.effectivenessScore >= 50 ? 'text-amber-600' : 'text-red-600')}>
                                      {link.effectivenessScore}/100
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}

                            {reevals.length > 0 && (
                              <div className="bg-red-50 rounded-lg p-3 text-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle size={14} className="text-red-600" />
                                  <span className="font-medium text-red-800">风险重评记录</span>
                                </div>
                                {reevals.map((rr) => (
                                  <div key={rr.id} className="text-gray-600 mb-1">
                                    原评分 <span className="font-medium">{rr.previousRiskScore}</span> 
                                    → 新评分 <span className="font-medium text-red-600">{rr.newRiskScore}</span>
                                    <span className="text-red-500"> (+{rr.adjustmentPoints}分)</span>
                                    <span className="text-gray-400 text-xs ml-2">{rr.reevaluatedAt}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
