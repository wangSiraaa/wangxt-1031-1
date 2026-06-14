import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react'
import { useStore } from '@/store'
import type { Issue, ReinspectionResult, IssueSeverity, IssueStatus } from '@/types'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'

const TABS = [
  { key: 'pending', label: '待复查', statuses: ['in_remediation', 'reinspection_in_progress', 'reopened'] as IssueStatus[] },
  { key: 'passed', label: '已通过', statuses: ['reinspection_passed'] as IssueStatus[] },
  { key: 'all', label: '全部', statuses: [] as IssueStatus[] },
]

const SEVERITY_BG: Record<IssueSeverity, string> = {
  high: 'bg-rose-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-blue-500 text-white',
}

const STATUS_BG: Record<string, string> = {
  in_remediation: 'bg-amber-100 text-amber-700',
  reinspection_in_progress: 'bg-blue-100 text-blue-700',
  reinspection_passed: 'bg-emerald-100 text-emerald-700',
  reopened: 'bg-rose-100 text-rose-700',
}

function daysLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export default function Reinspection() {
  const { issues, photos, reinspections, currentUser, fetchIssues, fetchPhotos, createReinspection, updateReinspection, addPhoto, closeIssue } = useStore()
  const [tab, setTab] = useState('pending')
  const [forms, setForms] = useState<Record<string, { result: ReinspectionResult; notes: string }>>({})

  useEffect(() => {
    fetchIssues()
    fetchPhotos()
  }, [fetchIssues, fetchPhotos])

  const filtered = issues.filter((issue) => {
    if (tab === 'all') return true
    const cfg = TABS.find((t) => t.key === tab)
    return cfg?.statuses.includes(issue.status)
  })

  const issuePhotos = (issueId: string) => photos.filter((p) => p.issueId === issueId && p.category === 'reinspection')
  const issueReinspection = (issueId: string) => reinspections.find((r) => r.issueId === issueId)

  const handleStart = async (issue: Issue) => {
    await createReinspection({ issueId: issue.id, inspector: currentUser.id, result: 'pending', notes: '', planDate: new Date().toISOString(), actualDate: new Date().toISOString() })
    fetchIssues()
  }

  const handleSubmit = async (issueId: string) => {
    const ri = issueReinspection(issueId)
    const form = forms[issueId]
    if (!ri || !form) return
    await updateReinspection(ri.id, { result: form.result, notes: form.notes, actualDate: new Date().toISOString() })
    fetchIssues()
  }

  const handleUpload = async (issueId: string) => {
    await addPhoto({ issueId, category: 'reinspection', url: `https://picsum.photos/seed/${Date.now()}/400/300`, uploadedBy: currentUser.id })
    fetchPhotos()
  }

  const handleClose = async (issueId: string) => {
    await closeIssue(issueId, currentUser.id)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldAlert size={24} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-zinc-900">安全复查</h1>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((issue) => {
          const reiP = issuePhotos(issue.id)
          const rei = issueReinspection(issue.id)
          const form = forms[issue.id] || { result: 'pass' as ReinspectionResult, notes: '' }
          const dl = daysLeft(issue.deadline)
          const canStart = issue.status === 'in_remediation' || issue.status === 'reopened'
          const inProgress = issue.status === 'reinspection_in_progress'
          const hasPhotos = reiP.length > 0
          const resultPass = form.result === 'pass'

          return (
            <div key={issue.id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-zinc-500">{issue.id}</span>
                  <span className="font-medium text-zinc-900">{issue.title}</span>
                  <span className={`${SEVERITY_BG[issue.severity]} rounded-full px-2 py-0.5 text-xs`}>{SEVERITY_LABELS[issue.severity]}</span>
                  <span className={`${STATUS_BG[issue.status] ?? 'bg-zinc-100 text-zinc-700'} rounded-full px-2 py-0.5 text-xs`}>{STATUS_LABELS[issue.status]}</span>
                </div>
                <span className={`flex items-center gap-1 text-xs ${dl < 0 ? 'text-rose-600' : dl <= 3 ? 'text-amber-600' : 'text-zinc-500'}`}>
                  <Clock size={12} />
                  {dl < 0 ? `逾期${Math.abs(dl)}天` : `${dl}天`}
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs">
                {hasPhotos ? <><CheckCircle2 size={14} className="text-emerald-500" /><span className="text-emerald-600">✓ 复查照片已上传</span></> : <><XCircle size={14} className="text-rose-500" /><span className="text-rose-600">✗ 缺少复查照片</span></>}
              </div>

              {rei && rei.result !== 'pending' && (
                <div className="text-xs text-zinc-600">复查结果: <span className={rei.result === 'pass' ? 'text-emerald-600' : 'text-rose-600'}>{rei.result === 'pass' ? '通过' : '不通过'}</span></div>
              )}

              {canStart && (
                <button onClick={() => handleStart(issue)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">开始复查</button>
              )}

              {inProgress && (
                <div className="space-y-3 border-t border-zinc-100 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">复查结果</label>
                      <select value={form.result} onChange={(e) => setForms({ ...forms, [issue.id]: { ...form, result: e.target.value as ReinspectionResult } })} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="pass">通过</option>
                        <option value="fail">不通过</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">备注</label>
                      <textarea value={form.notes} onChange={(e) => setForms({ ...forms, [issue.id]: { ...form, notes: e.target.value } })} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" rows={1} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUpload(issue.id)} className="flex items-center gap-1.5 border border-zinc-300 rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors">
                      <Camera size={14} />
                      上传复查照片
                    </button>
                    <button onClick={() => handleSubmit(issue.id)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">提交复查结果</button>
                  </div>

                  {reiP.length > 0 && (
                    <div className="flex gap-2">
                      {reiP.map((p) => (
                        <img key={p.id} src={p.url} alt="reinspection" className="w-16 h-16 rounded-md object-cover border border-zinc-200" />
                      ))}
                    </div>
                  )}

                  {resultPass && !hasPhotos && (
                    <div className="text-rose-600 text-xs">⚠ 复查照片缺失，无法关闭问题</div>
                  )}
                  {resultPass && hasPhotos && (
                    <button onClick={() => handleClose(issue.id)} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-emerald-700 transition-colors">关闭问题</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-zinc-400">暂无数据</div>}
      </div>
    </div>
  )
}
