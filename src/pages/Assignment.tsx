import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, UserCheck, FileText, Eye } from 'lucide-react'
import { useStore } from '@/store'
import type { Issue, IssueSeverity, IssueStatus } from '@/types'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'

type TabKey = 'submitted' | 'assigned' | 'in_remediation' | 'all'

const TABS: { key: TabKey; label: string; status?: IssueStatus }[] = [
  { key: 'submitted', label: '待分派', status: 'submitted' },
  { key: 'assigned', label: '待提交方案', status: 'assigned' },
  { key: 'in_remediation', label: '整改中', status: 'in_remediation' },
  { key: 'all', label: '全部' },
]

const SEVERITY_BG: Record<IssueSeverity, string> = {
  high: 'bg-rose-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-blue-500 text-white',
}

const STATUS_BG: Record<IssueStatus, string> = {
  overdue: 'bg-rose-100 text-rose-700',
  closed: 'bg-emerald-100 text-emerald-700',
  submitted: 'bg-zinc-100 text-zinc-700',
  assigned: 'bg-sky-100 text-sky-700',
  plan_submitted: 'bg-violet-100 text-violet-700',
  in_remediation: 'bg-amber-100 text-amber-700',
  reinspection_in_progress: 'bg-indigo-100 text-indigo-700',
  reinspection_passed: 'bg-emerald-100 text-emerald-700',
  reopened: 'bg-rose-100 text-rose-700',
}

function getCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return '已逾期'
  const days = Math.ceil(diff / 86400000)
  return `${days}天`
}

interface PlanFormState {
  rootCause: string
  plan: string
  capaMeasures: string
  responsiblePerson: string
  deadline: string
  extensionReason: string
  requestedDeadline: string
}

const initForm: PlanFormState = {
  rootCause: '', plan: '', capaMeasures: '', responsiblePerson: '', deadline: '',
  extensionReason: '', requestedDeadline: '',
}

export default function Assignment() {
  const navigate = useNavigate()
  const { issues, currentUser, users, fetchIssues, assignIssue, submitPlan, submitExtension } = useStore()
  const [tab, setTab] = useState<TabKey>('submitted')
  const [modalIssue, setModalIssue] = useState<Issue | null>(null)
  const [form, setForm] = useState<PlanFormState>(initForm)

  useEffect(() => { fetchIssues() }, [fetchIssues])

  const responsibleUsers = users.filter((u) => u.role === 'responsible')

  const filtered = issues.filter((i) => {
    const mine = i.assignedTo === currentUser.id || i.status === 'submitted'
    if (!mine) return false
    if (tab === 'all') return true
    return i.status === TABS.find((t) => t.key === tab)?.status
  })

  const handleClaim = async (id: string) => {
    await assignIssue(id, currentUser.id)
  }

  const handleOpenPlan = (issue: Issue) => {
    setModalIssue(issue)
    setForm(initForm)
  }

  const handleSubmitPlan = async () => {
    if (!modalIssue) return
    await submitPlan({
      issueId: modalIssue.id,
      rootCause: form.rootCause,
      plan: form.plan,
      capaMeasures: form.capaMeasures,
      responsiblePerson: form.responsiblePerson,
      deadline: form.deadline,
      createdBy: currentUser.id,
    })
    if (form.extensionReason && form.requestedDeadline) {
      await submitExtension({
        issueId: modalIssue.id,
        reason: form.extensionReason,
        requestedDeadline: form.requestedDeadline,
      })
    }
    setModalIssue(null)
  }

  const set = (k: keyof PlanFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">负责人分派</h1>

      <div className="flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((issue) => (
          <div key={issue.id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-zinc-400">{issue.id}</span>
                <h3 className="text-sm font-medium text-zinc-900">{issue.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`${SEVERITY_BG[issue.severity]} rounded-full px-2 py-0.5 text-xs`}>
                  {SEVERITY_LABELS[issue.severity]}
                </span>
                <span className={`${STATUS_BG[issue.status]} rounded-full px-2 py-0.5 text-xs`}>
                  {STATUS_LABELS[issue.status]}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock size={14} />
                截止: {issue.deadline}（{getCountdown(issue.deadline)}）
              </span>
              <div className="flex gap-2">
                {issue.status === 'submitted' && (
                  <button onClick={() => handleClaim(issue.id)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700">
                    <UserCheck size={14} /> 认领
                  </button>
                )}
                {issue.status === 'assigned' && (
                  <button onClick={() => handleOpenPlan(issue)} className="flex items-center gap-1 bg-amber-600 text-white px-3 py-1.5 rounded text-xs hover:bg-amber-700">
                    <FileText size={14} /> 提交整改方案
                  </button>
                )}
                {(issue.status === 'in_remediation' || issue.status === 'plan_submitted') && (
                  <button onClick={() => navigate(`/issues/${issue.id}`)} className="flex items-center gap-1 border border-zinc-300 px-3 py-1.5 rounded text-xs hover:bg-zinc-50">
                    <Eye size={14} /> 查看详情
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-zinc-400">暂无数据</div>}
      </div>

      {modalIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalIssue(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900">提交整改方案</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-600">根因分析</label>
                <textarea value={form.rootCause} onChange={set('rootCause')} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" rows={3} />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">整改方案</label>
                <textarea value={form.plan} onChange={set('plan')} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" rows={3} />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">CAPA措施</label>
                <textarea value={form.capaMeasures} onChange={set('capaMeasures')} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600">责任人</label>
                  <select value={form.responsiblePerson} onChange={set('responsiblePerson')} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">请选择</option>
                    {responsibleUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600">截止日期</label>
                  <input type="date" value={form.deadline} onChange={set('deadline')} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="border-t border-zinc-200 pt-3">
                <h3 className="text-sm font-medium text-zinc-700 mb-2">延期申请</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-600">延期原因</label>
                    <textarea value={form.extensionReason} onChange={set('extensionReason')} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" rows={2} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">申请截止日期</label>
                    <input type="date" value={form.requestedDeadline} onChange={set('requestedDeadline')} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalIssue(null)} className="px-4 py-2 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">取消</button>
              <button onClick={handleSubmitPlan} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">提交</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
