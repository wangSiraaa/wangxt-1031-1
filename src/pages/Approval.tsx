import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, FileText, Lock, ShieldAlert, ShieldCheck, AlertTriangle, Ban } from 'lucide-react'
import { useStore } from '@/store'
import type { IssueSeverity, ApprovalDecision, ApprovalType } from '@/types'
import { SEVERITY_LABELS, ROLE_LABELS } from '@/types'

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
  const { plans, extensions, approvals, issues, currentUser, error, fetchPlans, fetchExtensions, fetchApprovals, fetchIssues, approvePlan, approveExtension, clearError } = useStore()
  const [tab, setTab] = useState<Tab>('pending_plans')
  const [comments, setComments] = useState<Record<string, string>>({})
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetchPlans()
    fetchExtensions()
    fetchApprovals()
    fetchIssues()
  }, [fetchPlans, fetchExtensions, fetchApprovals, fetchIssues])

  const isSupervisor = currentUser.role === 'supervisor'

  const getIssue = (issueId: string) => issues.find((i) => i.id === issueId)
  const getComment = (id: string) => comments[id] || ''
  const setComment = (id: string, val: string) => setComments((p) => ({ ...p, [id]: val }))

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message })
    setTimeout(() => setActionFeedback(null), 4000)
  }

  const handleApprovePlan = async (planId: string) => {
    if (!isSupervisor) {
      showFeedback('error', `越权拦截：${currentUser.name}（${ROLE_LABELS[currentUser.role]}）无主管审批权限，仅主管角色可审批（R009）`)
      return
    }
    clearError()
    await approvePlan(planId, 'approved', getComment(planId), currentUser.id)
    if (useStore.getState().error) {
      showFeedback('error', useStore.getState().error!)
    } else {
      showFeedback('success', '方案审批通过')
    }
    setComments((p) => { const n = { ...p }; delete n[planId]; return n })
  }

  const handleRejectPlan = async (planId: string) => {
    if (!isSupervisor) {
      showFeedback('error', `越权拦截：${currentUser.name}（${ROLE_LABELS[currentUser.role]}）无主管审批权限`)
      return
    }
    clearError()
    await approvePlan(planId, 'rejected', getComment(planId), currentUser.id)
    if (useStore.getState().error) {
      showFeedback('error', useStore.getState().error!)
    } else {
      showFeedback('success', '方案已驳回')
    }
    setComments((p) => { const n = { ...p }; delete n[planId]; return n })
  }

  const handleApproveExtension = async (extId: string) => {
    if (!isSupervisor) {
      showFeedback('error', `越权拦截：${currentUser.name}（${ROLE_LABELS[currentUser.role]}）无主管审批权限`)
      return
    }
    clearError()
    await approveExtension(extId, 'approved', getComment(extId), currentUser.id)
    if (useStore.getState().error) {
      showFeedback('error', useStore.getState().error!)
    } else {
      showFeedback('success', '延期申请已批准')
    }
    setComments((p) => { const n = { ...p }; delete n[extId]; return n })
  }

  const handleRejectExtension = async (extId: string) => {
    if (!isSupervisor) {
      showFeedback('error', `越权拦截：${currentUser.name}（${ROLE_LABELS[currentUser.role]}）无主管审批权限`)
      return
    }
    clearError()
    await approveExtension(extId, 'rejected', getComment(extId), currentUser.id)
    if (useStore.getState().error) {
      showFeedback('error', useStore.getState().error!)
    } else {
      showFeedback('success', '延期申请已拒绝')
    }
    setComments((p) => { const n = { ...p }; delete n[extId]; return n })
  }

  const pendingPlans = plans.filter((p) => p.status === 'submitted')
  const pendingExtensions = extensions.filter((e) => e.status === 'pending')
  const sortedApprovals = [...approvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const highRiskPending = pendingPlans.filter((p) => {
    const issue = getIssue(p.issueId)
    return issue?.severity === 'high'
  })

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending_plans', label: '待审批方案', count: pendingPlans.length },
    { key: 'pending_extensions', label: '待审批延期', count: pendingExtensions.length },
    { key: 'completed', label: '已审批', count: sortedApprovals.length },
  ]

  if (!isSupervisor) {
    return (
      <div className="p-6">
        <div className="border border-rose-200 bg-rose-50 rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
            <Lock className="h-8 w-8 text-rose-500" />
          </div>
          <h2 className="text-lg font-semibold text-rose-700">无访问权限</h2>
          <div className="flex items-center gap-2 text-rose-600">
            <Ban className="h-4 w-4" />
            <span className="text-sm">
              当前用户 <strong>{currentUser.name}</strong>（{ROLE_LABELS[currentUser.role]}）无主管审批权限
            </span>
          </div>
          <p className="text-sm text-rose-500 max-w-md">
            根据 R009 规则，主管审批功能仅对 supervisor 角色开放。审厂员、企业负责人和安全专员均无权审批高风险整改方案或延期申请。
          </p>
          <div className="flex items-center gap-2 bg-rose-100 rounded-lg px-4 py-2 text-xs text-rose-600">
            <AlertTriangle size={14} />
            <span>越权访问尝试已被审计系统记录</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            请在左下角切换到「赵主管」账号后访问本页面
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">主管审批</h1>
          <span className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1">
            <ShieldCheck size={12} />
            {currentUser.name}（主管）
          </span>
        </div>
      </div>

      {actionFeedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {actionFeedback.type === 'success' ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
          {actionFeedback.message}
        </div>
      )}

      {highRiskPending.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={16} />
          <span>当前有 <strong>{highRiskPending.length}</strong> 个高风险整改方案待审批，根据 R001 规则，未经主管审批的高风险方案不能进入整改</span>
        </div>
      )}

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
            const isHighRisk = issue?.severity === 'high'
            return (
              <div key={plan.id} className={`border rounded-lg p-4 space-y-3 ${isHighRisk ? 'border-rose-300 bg-rose-50/30' : 'border-zinc-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 font-mono">{plan.issueId}</span>
                  {issue && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span className="text-sm text-zinc-900 font-medium">{issue.title}</span>
                      <span className={`${SEVERITY_BG[issue.severity]} rounded-full px-2 py-0.5 text-xs`}>
                        {SEVERITY_LABELS[issue.severity]}
                      </span>
                      {isHighRisk && (
                        <span className="flex items-center gap-1 text-xs bg-rose-100 text-rose-700 rounded-full px-2 py-0.5 border border-rose-300 font-medium">
                          <ShieldAlert size={10} />
                          需主管审批（R001）
                        </span>
                      )}
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
                <div className="flex items-center gap-2">
                  <button onClick={() => handleApprovePlan(plan.id)} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                    <CheckCircle size={14} />通过
                  </button>
                  <button onClick={() => handleRejectPlan(plan.id)} className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors text-sm">
                    <XCircle size={14} />驳回
                  </button>
                  {isHighRisk && (
                    <span className="text-xs text-rose-500 ml-2">
                      审批通过后问题将进入整改阶段
                    </span>
                  )}
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
                <th className="px-4 py-3 font-medium">角色</th>
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
                  <td className="px-4 py-3 text-zinc-700">{rec.approverName || rec.approver}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-zinc-100 text-zinc-600 rounded px-1.5 py-0.5">
                      {rec.approverRole ? ROLE_LABELS[rec.approverRole] : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">{rec.comment || '-'}</td>
                  <td className="px-4 py-3 text-zinc-500">{rec.createdAt}</td>
                </tr>
              ))}
              {sortedApprovals.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-zinc-400">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
