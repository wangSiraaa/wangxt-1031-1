import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, XCircle, Clock, ShieldAlert, Lock, Activity, Users, Plus, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Issue, ReinspectionResult, IssueSeverity, IssueStatus, MonitoringData, ClientConfirmation } from '@/types'
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
  const { issues, photos, reinspections, monitoringData, clientConfirmations, currentUser, loading, fetchIssues, fetchPhotos, fetchMonitoringData, fetchClientConfirmations, createReinspection, updateReinspection, addPhoto, addPhotoSupplement, lockPhotoAsEvidence, createMonitoringData, lockMonitoringAsEvidence, createClientConfirmation, lockClientConfirmationAsEvidence, closeIssue, checkCanClose } = useStore()
  const [tab, setTab] = useState('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, { result: ReinspectionResult; notes: string }>>({})
  const [monitoringForms, setMonitoringForms] = useState<Record<string, Partial<MonitoringData>>>({})
  const [clientForms, setClientForms] = useState<Record<string, Partial<ClientConfirmation>>>({})

  useEffect(() => {
    fetchIssues()
    fetchPhotos()
    fetchMonitoringData()
    fetchClientConfirmations()
  }, [fetchIssues, fetchPhotos, fetchMonitoringData, fetchClientConfirmations])

  const filtered = issues.filter((issue) => {
    if (tab === 'all') return true
    const cfg = TABS.find((t) => t.key === tab)
    return cfg?.statuses.includes(issue.status)
  })

  const issuePhotos = (issueId: string) => photos.filter((p) => p.issueId === issueId && p.category === 'reinspection')
  const issueReinspection = (issueId: string) => reinspections.find((r) => r.issueId === issueId)
  const issueMonitoring = (issueId: string) => monitoringData.filter((m) => m.issueId === issueId)
  const issueClientConfirmations = (issueId: string) => clientConfirmations.filter((c) => c.issueId === issueId)

  const hasClosureEvidence = (issueId: string) => {
    const ps = issuePhotos(issueId).some(p => p.isClosureEvidence)
    const ms = issueMonitoring(issueId).some(m => m.isClosureEvidence)
    const cs = issueClientConfirmations(issueId).some(c => c.isClosureEvidence)
    return ps || ms || cs
  }

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

  const handleSupplement = async (issueId: string, parentPhotoId: string) => {
    await addPhotoSupplement(parentPhotoId, {
      issueId,
      category: 'reinspection',
      url: `https://picsum.photos/seed/${Date.now()}_supp/400/300`,
      uploadedBy: currentUser.id,
      isSupplemental: true,
    })
    fetchPhotos()
  }

  const handleLockPhoto = async (photoId: string) => {
    await lockPhotoAsEvidence(photoId, currentUser.id)
    fetchPhotos()
    fetchIssues()
  }

  const handleAddMonitoring = async (issueId: string) => {
    const form = monitoringForms[issueId]
    if (!form || !form.parameter || !form.value) return
    await createMonitoringData({
      issueId,
      type: form.type || 'other',
      parameter: form.parameter,
      value: form.value,
      unit: form.unit || '',
      standardLimit: form.standardLimit || '',
      measuredBy: currentUser.id,
      measuredAt: new Date().toISOString(),
      isClosureEvidence: false,
      notes: form.notes,
    })
    setMonitoringForms({ ...monitoringForms, [issueId]: {} })
    fetchMonitoringData()
  }

  const handleLockMonitoring = async (monitoringId: string) => {
    await lockMonitoringAsEvidence(monitoringId, currentUser.id)
    fetchMonitoringData()
    fetchIssues()
  }

  const handleAddClientConfirmation = async (issueId: string) => {
    const form = clientForms[issueId]
    if (!form || !form.confirmedBy || !form.confirmationContent) return
    await createClientConfirmation({
      issueId,
      confirmedBy: form.confirmedBy,
      confirmationContent: form.confirmationContent,
      contactInfo: form.contactInfo,
      confirmedAt: new Date().toISOString(),
      isClosureEvidence: false,
    })
    setClientForms({ ...clientForms, [issueId]: {} })
    fetchClientConfirmations()
  }

  const handleLockClientConfirmation = async (confirmationId: string) => {
    await lockClientConfirmationAsEvidence(confirmationId, currentUser.id)
    fetchClientConfirmations()
    fetchIssues()
  }

  const handleClose = async (issueId: string) => {
    const canCloseResult = await checkCanClose(issueId)
    if (canCloseResult && !canCloseResult.canClose) {
      alert(`无法关闭问题：${canCloseResult.reason}`)
      return
    }
    await closeIssue(issueId, currentUser.id)
    fetchIssues()
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
          const monData = issueMonitoring(issue.id)
          const clientConf = issueClientConfirmations(issue.id)
          const form = forms[issue.id] || { result: 'pass' as ReinspectionResult, notes: '' }
          const monForm = monitoringForms[issue.id] || { type: 'other', parameter: '', value: '', unit: '', standardLimit: '', notes: '' }
          const cliForm = clientForms[issue.id] || { confirmedBy: '', confirmationContent: '', contactInfo: '' }
          const dl = daysLeft(issue.deadline)
          const canStart = issue.status === 'in_remediation' || issue.status === 'reopened'
          const inProgress = issue.status === 'reinspection_in_progress'
          const hasPhotos = reiP.length > 0
          const hasMonData = monData.length > 0
          const hasClientConf = clientConf.length > 0
          const hasEvidence = hasPhotos || hasMonData || hasClientConf
          const hasLockedEvidence = hasClosureEvidence(issue.id)
          const resultPass = form.result === 'pass'
          const isExpanded = expandedId === issue.id

          return (
            <div key={issue.id} className={cn('border border-zinc-200 rounded-lg overflow-hidden', issue.closureEvidenceLocked && 'border-emerald-300')}>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-zinc-500">{issue.id}</span>
                    <span className="font-medium text-zinc-900">{issue.title}</span>
                    <span className={`${SEVERITY_BG[issue.severity]} rounded-full px-2 py-0.5 text-xs`}>{SEVERITY_LABELS[issue.severity]}</span>
                    <span className={`${STATUS_BG[issue.status] ?? 'bg-zinc-100 text-zinc-700'} rounded-full px-2 py-0.5 text-xs`}>{STATUS_LABELS[issue.status]}</span>
                    {issue.closureEvidenceLocked && (
                      <span className="bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 text-xs flex items-center gap-1">
                        <Lock size={10} /> 证据已锁定
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasLockedEvidence && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <Lock size={12} /> 不可覆盖
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-xs ${dl < 0 ? 'text-rose-600' : dl <= 3 ? 'text-amber-600' : 'text-zinc-500'}`}>
                      <Clock size={12} />
                      {dl < 0 ? `逾期${Math.abs(dl)}天` : `${dl}天`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    {hasPhotos ? <><CheckCircle2 size={14} className="text-emerald-500" /><span className="text-emerald-600">✓ 复查照片 ({reiP.length}张)</span></> : <><XCircle size={14} className="text-rose-500" /><span className="text-rose-600">✗ 缺少复查照片</span></>}
                  </div>
                  <div className="flex items-center gap-1">
                    {hasMonData ? <><CheckCircle2 size={14} className="text-emerald-500" /><span className="text-emerald-600">✓ 监测数据 ({monData.length}条)</span></> : <><XCircle size={14} className="text-zinc-400" /><span className="text-zinc-400">— 无监测数据</span></>}
                  </div>
                  <div className="flex items-center gap-1">
                    {hasClientConf ? <><CheckCircle2 size={14} className="text-emerald-500" /><span className="text-emerald-600">✓ 客户确认 ({clientConf.length}条)</span></> : <><XCircle size={14} className="text-zinc-400" /><span className="text-zinc-400">— 无客户确认</span></>}
                  </div>
                </div>

                {rei && rei.result !== 'pending' && (
                  <div className="text-xs text-zinc-600">复查结果: <span className={rei.result === 'pass' ? 'text-emerald-600' : 'text-rose-600'}>{rei.result === 'pass' ? '通过' : '不通过'}</span></div>
                )}

                {canStart && (
                  <button onClick={() => handleStart(issue)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">开始复查</button>
                )}

                {hasEvidence && (
                  <button 
                    onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    {isExpanded ? '收起证据链 ▲' : '展开证据链 ▼'}
                  </button>
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

                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => handleUpload(issue.id)} className="flex items-center gap-1.5 border border-zinc-300 rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors">
                        <Camera size={14} />
                        上传复查照片
                      </button>
                      <button onClick={() => handleSubmit(issue.id)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">提交复查结果</button>
                    </div>

                    {reiP.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-600">复查照片（证据不可覆盖，可追加补证）</div>
                        <div className="flex flex-wrap gap-2">
                          {reiP.map((p) => (
                            <div key={p.id} className="relative group">
                              <img src={p.url} alt="reinspection" className={cn('w-20 h-20 rounded-md object-cover border-2', p.isClosureEvidence ? 'border-emerald-500' : 'border-zinc-200')} />
                              {p.isClosureEvidence && (
                                <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
                                  <Lock size={10} />
                                </div>
                              )}
                              {p.isSupplemental && (
                                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[10px] px-1 rounded">
                                  补证
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-1">
                                {!p.isClosureEvidence && !issue.closureEvidenceLocked && (
                                  <button 
                                    onClick={() => handleLockPhoto(p.id)} 
                                    className="text-xs bg-emerald-500 text-white px-2 py-1 rounded"
                                  >
                                    锁定
                                  </button>
                                )}
                                {p.isClosureEvidence && !p.isSupplemental && (
                                  <button 
                                    onClick={() => handleSupplement(issue.id, p.id)} 
                                    className="text-xs bg-amber-500 text-white px-2 py-1 rounded"
                                  >
                                    补证
                                  </button>
                                )}
                              </div>
                              {p.evidenceVersion && (
                                <div className="absolute -top-1 -left-1 bg-indigo-500 text-white text-[10px] px-1 rounded">
                                  v{p.evidenceVersion}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-cyan-800 flex items-center gap-1">
                          <Activity size={12} /> 监测数据
                        </span>
                      </div>
                      {monData.length > 0 && (
                        <div className="space-y-1">
                          {monData.map((m) => (
                            <div key={m.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                              <span>{m.parameter}: {m.value} {m.unit} (限值: {m.standardLimit})</span>
                              <div className="flex items-center gap-1">
                                {m.isClosureEvidence && <Lock size={10} className="text-emerald-500" />}
                                {!m.isClosureEvidence && !issue.closureEvidenceLocked && (
                                  <button onClick={() => handleLockMonitoring(m.id)} className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                                    锁定
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        <input 
                          placeholder="监测项" 
                          value={monForm.parameter || ''} 
                          onChange={(e) => setMonitoringForms({ ...monitoringForms, [issue.id]: { ...monForm, parameter: e.target.value } })}
                          className="border border-cyan-300 rounded px-1.5 py-1"
                        />
                        <input 
                          placeholder="数值" 
                          value={monForm.value || ''} 
                          onChange={(e) => setMonitoringForms({ ...monitoringForms, [issue.id]: { ...monForm, value: e.target.value } })}
                          className="border border-cyan-300 rounded px-1.5 py-1"
                        />
                        <input 
                          placeholder="单位" 
                          value={monForm.unit || ''} 
                          onChange={(e) => setMonitoringForms({ ...monitoringForms, [issue.id]: { ...monForm, unit: e.target.value } })}
                          className="border border-cyan-300 rounded px-1.5 py-1"
                        />
                        <button 
                          onClick={() => handleAddMonitoring(issue.id)} 
                          className="bg-cyan-500 text-white rounded px-2 py-1 flex items-center justify-center gap-0.5 hover:bg-cyan-600"
                        >
                          <Plus size={12} /> 添加
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-purple-800 flex items-center gap-1">
                          <Users size={12} /> 客户确认
                        </span>
                      </div>
                      {clientConf.length > 0 && (
                        <div className="space-y-1">
                          {clientConf.map((c) => (
                            <div key={c.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                              <span className="flex-1"><strong>{c.confirmedBy}:</strong> {c.confirmationContent}</span>
                              <div className="flex items-center gap-1 ml-2">
                                {c.isClosureEvidence && <Lock size={10} className="text-emerald-500" />}
                                {!c.isClosureEvidence && !issue.closureEvidenceLocked && (
                                  <button onClick={() => handleLockClientConfirmation(c.id)} className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                                    锁定
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1 text-xs">
                        <input 
                          placeholder="确认人" 
                          value={cliForm.confirmedBy || ''} 
                          onChange={(e) => setClientForms({ ...clientForms, [issue.id]: { ...cliForm, confirmedBy: e.target.value } })}
                          className="w-full border border-purple-300 rounded px-1.5 py-1"
                        />
                        <div className="flex gap-1">
                          <input 
                            placeholder="确认内容" 
                            value={cliForm.confirmationContent || ''} 
                            onChange={(e) => setClientForms({ ...clientForms, [issue.id]: { ...cliForm, confirmationContent: e.target.value } })}
                            className="flex-1 border border-purple-300 rounded px-1.5 py-1"
                          />
                          <button 
                            onClick={() => handleAddClientConfirmation(issue.id)} 
                            className="bg-purple-500 text-white rounded px-2 py-1 flex items-center justify-center gap-0.5 hover:bg-purple-600 whitespace-nowrap"
                          >
                            <Plus size={12} /> 添加
                          </button>
                        </div>
                      </div>
                    </div>

                    {resultPass && !hasEvidence && (
                      <div className="text-rose-600 text-xs flex items-center gap-1 bg-rose-50 p-2 rounded">
                        <AlertTriangle size={12} /> 缺少关闭证据（照片、监测数据或客户确认），无法关闭问题
                      </div>
                    )}
                    {resultPass && hasEvidence && !hasLockedEvidence && (
                      <div className="text-amber-600 text-xs flex items-center gap-1 bg-amber-50 p-2 rounded">
                        <AlertTriangle size={12} /> 请将证据锁定作为关闭依据后，再关闭问题
                      </div>
                    )}
                    {resultPass && hasLockedEvidence && (
                      <button onClick={() => handleClose(issue.id)} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-emerald-700 transition-colors flex items-center gap-1">
                        <Lock size={14} /> 关闭问题（证据已锁定）
                      </button>
                    )}
                  </div>
                )}

                {isExpanded && !inProgress && hasEvidence && (
                  <div className="space-y-3 border-t border-zinc-100 pt-3 bg-gray-50 rounded-lg p-3">
                    {reiP.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-600 mb-2">复查照片</div>
                        <div className="flex flex-wrap gap-2">
                          {reiP.map((p) => (
                            <div key={p.id} className="relative">
                              <img src={p.url} alt="reinspection" className={cn('w-16 h-16 rounded object-cover border-2', p.isClosureEvidence ? 'border-emerald-500' : 'border-zinc-200')} />
                              {p.isClosureEvidence && <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5"><Lock size={8} /></div>}
                              {p.isSupplemental && <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[8px] px-1 rounded">补证</div>}
                              {p.evidenceVersion && <div className="absolute -top-1 -left-1 bg-indigo-500 text-white text-[8px] px-1 rounded">v{p.evidenceVersion}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {monData.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-600 mb-1">监测数据</div>
                        {monData.map((m) => (
                          <div key={m.id} className="text-xs bg-white rounded px-2 py-1 mb-1 flex items-center gap-2">
                            <Activity size={10} className="text-cyan-500" />
                            <span>{m.parameter}: {m.value} {m.unit}</span>
                            {m.isClosureEvidence && <Lock size={10} className="text-emerald-500" />}
                          </div>
                        ))}
                      </div>
                    )}
                    {clientConf.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-600 mb-1">客户确认</div>
                        {clientConf.map((c) => (
                          <div key={c.id} className="text-xs bg-white rounded px-2 py-1 mb-1 flex items-center gap-2">
                            <Users size={10} className="text-purple-500" />
                            <span><strong>{c.confirmedBy}:</strong> {c.confirmationContent}</span>
                            {c.isClosureEvidence && <Lock size={10} className="text-emerald-500" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-zinc-400">暂无数据</div>}
      </div>
    </div>
  )
}
