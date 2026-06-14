import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react'
import { useStore } from '@/store'
import type { IssueSeverity, ApprovalDecision, ApprovalType } from '@/types'
import { SEVERITY_LABELS } from '@/types'

const SEVERITY_BG: Record<IssueSeverity, string> = {
  high: 'bg-rose-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-blue-500 text-white',
}

const DECISION_BG: Record<ApprovalDecision, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
}

const TYPE_LABELS: Record<ApprovalType, string> = {
  plan_approval: '方案审批',
  extension_approval: '延期审批',
}

type Tab = 'pending_plans' | 'pending_extensions' | 'completed'

export default function Approval() {
  const { plans, extensions, approvals, issues, currentUser, fetchPlans, fetchExtensions, fetchApprovals, fetchIssues, approvePlan, approveExtension } = useStore()
  const [tab, setTab] = useState<Tab>('pending_plans')
  const [comments, setComments] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchPlans()
    fetchExtensions()
    fetchApprovals()
    fetchIssues()
  }, [fetchPlans, fetchExtensions, fetchApprovals, fetchIssues])

  const getIssue = (issueId: string) => issues.find((i) => i.id === issueId)
  const getComment = (id: string) => comments[id] || ''
  const setComment = (id: string, val: string) => setComments((p) => ({ ...p, [id]: val }))

  const handleApprovePlan = async (planId: string) => {
    await approvePlan(planId, 'approved', getComment(planId), currentUser.id)
    setComments((p) => { const n = { ...p }; delete n[planId]; return n })
  }

  const handleRejectPlan = async (planId: string) => {
    await approvePlan(planId, 'rejected', getComment(planId), currentUser.id)
    setComments((p) => { const n = { ...p }; delete n[planId]; return n })
  }

  const handleApproveExtension = async (extId: string) => {
    await approveExtension(extId, 'approved', getComment(extId), currentUser.id)
    setComments((p) => { const n = { ...p }; delete n[extId]; return n })
  }

  const handleRejectExtension = async (extId: string) => {
    await approveExtension(extId, 'rejected', getComment(extId), currentUser.id)
    setComments((p) => { const n = { ...p }; delete n[extId]; return n })
  }

  const pendingPlans = plans.filter((p) => p.status === 'submitted')
  const pendingExtensions = extensions.filter((e) => e.status === 'pending')
  const sortedApprovals = [...approvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending_plans', label: '待审批方案', count: pendingPlans.length },
    { key: 'pending_extensions', label: '待审批延期', count: pendingExtensions.length },
    { key: 'completed', label: '已审批', count: sortedApprovals.length },
  ]

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">主管审批</h1>

      <div className="flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
              tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'pending_plans' && (
        <div className="space-y-4">
          {pendingPlans.length === 0 && <div className="text-center py-12 text-zinc-400">暂无待审批方案</div>}
          {pendingPlans.map((plan) => {
            const issue = getIssue(plan.issueId)
            return (
              <div key={plan.id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 font-mono">{plan.issueId}</span>
                  {issue && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span className="text-sm text-zinc-900 font-medium">{issue.title}</span>
                      <span className={`${SEVERITY_BG[issue.severity]} rounded-full px-2 py-0.5 text-xs`}>
                        {SEVERITY_LABELS[issue.severity]}
                      </span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-zinc-500">根因：</span>{plan.rootCause}</div>
                  <div><span className="text-zinc-500">方案：</span>{plan.plan}</div>
                  <div><span className="text-zinc-500">CAPA措施：</span>{plan.capaMeasures}</div>
                  <div><span className="text-zinc-500">负责人：</span>{plan.responsiblePerson}</div>
                  <div><span className="text-zinc-500">截止日：</span>{plan.deadline}</div>
                </div>
                <textarea
                  value={getComment(plan.id)}
                  onChange={(e) => setComment(plan.id, e.target.value)}
                  placeholder="审批意见..."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none h-16"
                />
                <div className="flex gap-2">
                  <button onClick={() => handleApprovePlan(plan.id)} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                    <CheckCircle size={14} />通过
                  </button>
                  <button onClick={() => handleRejectPlan(plan.id)} className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors text-sm">
                    <XCircle size={14} />驳回
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'pending_extensions' && (
        <div className="space-y-4">
          {pendingExtensions.length === 0 && <div className="text-center py-12 text-zinc-400">暂无待审批延期</div>}
          {pendingExtensions.map((ext) => {
            const issue = getIssue(ext.issueId)
            return (
              <div key={ext.id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 font-mono">{ext.issueId}</span>
                  {issue && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span className="text-sm text-zinc-900 font-medium">{issue.title}</span>
                      <span className={`${SEVERITY_BG[issue.severity]} rounded-full px-2 py-0.5 text-xs`}>
                        {SEVERITY_LABELS[issue.severity]}
                      </span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><span className="text-zinc-500">延期原因：</span>{ext.reason}</div>
                  <div><span className="text-zinc-500">申请截止日：</span>{ext.requestedDeadline}</div>
                  <div><span className="text-zinc-500">原截止日：</span>{issue?.deadline ?? '-'}</div>
                </div>
                <textarea
                  value={getComment(ext.id)}
                  onChange={(e) => setComment(ext.id, e.target.value)}
                  placeholder="审批意见..."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none h-16"
                />
                <div className="flex gap-2">
                  <button onClick={() => handleApproveExtension(ext.id)} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                    <CheckCircle size={14} />批准
                  </button>
                  <button onClick={() => handleRejectExtension(ext.id)} className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors text-sm">
                    <XCircle size={14} />拒绝
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'completed' && (
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">问题编号</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">决定</th>
                <th className="px-4 py-3 font-medium">审批人</th>
                <th className="px-4 py-3 font-medium">意见</th>
                <th className="px-4 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {sortedApprovals.map((rec) => (
                <tr key={rec.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-mono text-zinc-900">{rec.issueId}</td>
                  <td className="px-4 py-3">
                    <span className="bg-zinc-100 text-zinc-700 rounded-full px-2 py-0.5 text-xs flex items-center gap-1 w-fit">
                      {rec.type === 'plan_approval' ? <FileText size={12} /> : <Clock size={12} />}
                      {TYPE_LABELS[rec.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`${DECISION_BG[rec.decision]} rounded-full px-2 py-0.5 text-xs`}>
                      {rec.decision === 'approved' ? '通过' : '驳回'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{rec.approver}</td>
                  <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">{rec.comment || '-'}</td>
                  <td className="px-4 py-3 text-zinc-500">{rec.createdAt}</td>
                </tr>
              ))}
              {sortedApprovals.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-zinc-400">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
