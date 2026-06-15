import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle, Clock, Camera, History, Link2, ShieldAlert, Lock, Layers, RefreshCw, Activity, Users, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'
import type { IssueSeverity, IssueStatus, PhotoCategory, LayeredRecordType } from '@/types'
import { STATUS_LABELS, SEVERITY_LABELS, ROLE_LABELS } from '@/types'

const severityStyles: Record<IssueSeverity, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
}

const statusStyles: Record<IssueStatus, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  assigned: 'bg-blue-100 text-blue-700',
  plan_submitted: 'bg-purple-100 text-purple-700',
  in_remediation: 'bg-orange-100 text-orange-700',
  reinspection_in_progress: 'bg-cyan-100 text-cyan-700',
  reinspection_passed: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  reopened: 'bg-amber-100 text-amber-700',
  closed: 'bg-gray-200 text-gray-600',
}

const photoCategoryLabels: Record<PhotoCategory, string> = {
  evidence: '证据照片',
  remediation: '整改照片',
  reinspection: '复查照片',
}

const layeredRecordTypeLabels: Record<LayeredRecordType, string> = {
  rectification_plan: '整改方案',
  capa_measures: 'CAPA措施',
  extension_request: '延期申请',
  supervisor_approval: '主管审批',
}

const layeredRecordStatusLabels: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  approved: '已批准',
  rejected: '已驳回',
  pending: '待处理',
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', className)}>{label}</span>
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-3">{icon}{title}</h3>
      {children}
    </div>
  )
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  return `${days}天前`
}

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { issueDetail, currentUser, fetchIssueDetail, loading } = useStore()

  useEffect(() => {
    if (id) fetchIssueDetail(id)
  }, [id])

  if (loading || !issueDetail) {
    return <div className="flex items-center justify-center h-96 text-gray-400">加载中...</div>
  }

  const issue = issueDetail

  const isHighRiskEscalation = issue.involvesWorkStop && issue.involvesExternalSupplier && issue.regulationUpdate

  const actionButton = (() => {
    if (currentUser.role === 'auditor' && issue.status === 'closed') {
      return { label: '重开问题', path: `/issues/${issue.id}/reopen` }
    }
    if (currentUser.role === 'responsible' && issue.status === 'assigned') {
      return { label: '提交整改方案', path: '/assignment' }
    }
    if (currentUser.role === 'safety' && (issue.status === 'in_remediation' || issue.status === 'reopened')) {
      return { label: '开始复查', path: '/reinspection' }
    }
    if (currentUser.role === 'supervisor' && issue.status === 'plan_submitted') {
      return { label: '审批方案', path: '/approval' }
    }
    return null
  })()

  const needsApprovalGate = issue.severity === 'high' && issue.status === 'plan_submitted'
  const nonSupervisorViewingApproval = needsApprovalGate && currentUser.role !== 'supervisor'
  const hasApprovedPlan = issue.plans.some((p) => p.status === 'approved')

  const groupedPhotos = issue.photos.reduce<Record<PhotoCategory, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, {} as Record<PhotoCategory, number>)

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/issues')} className="p-2 rounded hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <span className="text-sm text-gray-500 font-mono">{issue.id}</span>
        <Badge label={SEVERITY_LABELS[issue.severity]} className={severityStyles[issue.severity]} />
        <Badge label={STATUS_LABELS[issue.status]} className={statusStyles[issue.status]} />
        <Badge label={`v${issue.version}`} className="bg-indigo-100 text-indigo-700" />
        {actionButton && (
          <button onClick={() => navigate(actionButton.path)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            {actionButton.label}
          </button>
        )}
      </div>

      {nonSupervisorViewingApproval && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <Lock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-800">
              高风险整改方案审批门控（R001）
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              当前用户 <strong>{currentUser.name}</strong>（{ROLE_LABELS[currentUser.role]}）无权审批此高风险方案。仅主管角色可将此问题推进到整改阶段。请通知主管进行审批。
            </div>
          </div>
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
        </div>
      )}

      {needsApprovalGate && currentUser.role === 'supervisor' && !hasApprovedPlan && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 mb-4">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-rose-800">
              待您审批的高风险整改方案
            </div>
            <div className="text-xs text-rose-600 mt-0.5">
              此高风险问题的整改方案需您审批后方可进入整改阶段（R001）。请点击「审批方案」按钮进行审批。
            </div>
          </div>
        </div>
      )}

      {isHighRiskEscalation && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-red-800 flex items-center gap-2">
              高风险升级（R014）
              <Badge label="停工" className="bg-red-200 text-red-700" />
              <Badge label="外协供应商" className="bg-orange-200 text-orange-700" />
              <Badge label="法规更新" className="bg-purple-200 text-purple-700" />
            </div>
            <div className="text-xs text-red-600 mt-0.5">
              此问题涉及停工、外协供应商和法规条款更新，需分层记录整改方案、CAPA措施、延期申请和主管审批（R010）。风险评分已扣减30分。
            </div>
          </div>
          <ShieldCheck className="h-5 w-5 text-red-500 shrink-0" />
        </div>
      )}

      {issue.recurrenceRound && issue.recurrenceRound > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <RefreshCw className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-800">
              复发问题 · 第 {issue.recurrenceRound} 轮
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              半年内同类问题重复出现（R011），已自动关联历史轮次并重新评估风险评分（R013）。
            </div>
          </div>
        </div>
      )}

      {issue.closureEvidenceLocked && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
          <Lock className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-emerald-800">
              关闭证据已锁定（R012）
            </div>
            <div className="text-xs text-emerald-600 mt-0.5">
              复查照片、监测数据和客户确认已作为关闭依据提交。证据不可覆盖，仅可追加补证。
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="基本信息" icon={<FileText size={18} />}>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500 w-24 inline-block">标题</span>{issue.title}</div>
              <div><span className="text-gray-500 w-24 inline-block">法规条款</span>{issue.regulationClause}</div>
              <div><span className="text-gray-500 w-24 inline-block">描述</span>{issue.description}</div>
              <div><span className="text-gray-500 w-24 inline-block">客户确认</span>{issue.clientConfirmationRequired ? '是' : '否'}</div>
              <div><span className="text-gray-500 w-24 inline-block">牵涉停工</span>{issue.involvesWorkStop ? '是' : '否'}</div>
              <div><span className="text-gray-500 w-24 inline-block">牵涉外协</span>{issue.involvesExternalSupplier ? '是' : '否'}</div>
              <div><span className="text-gray-500 w-24 inline-block">法规更新</span>{issue.regulationUpdate ? '是' : '否'}</div>
              <div><span className="text-gray-500 w-24 inline-block">截止日期</span>{issue.deadline}</div>
              <div><span className="text-gray-500 w-24 inline-block">创建时间</span>{issue.createdAt}</div>
              <div><span className="text-gray-500 w-24 inline-block">负责人</span>{issue.assignedTo ?? '—'}</div>
            </div>
          </Card>

          <Card title="整改方案" icon={<CheckCircle size={18} />}>
            {issue.plans.length === 0 ? (
              <p className="text-sm text-gray-400">暂无整改方案</p>
            ) : issue.plans.map((p) => (
              <div key={p.id} className="border rounded p-3 mb-2 text-sm">
                <div className="font-medium">{p.rootCause}</div>
                <div className="text-gray-600 mt-1">{p.plan}</div>
                <div className="text-gray-500 mt-1">CAPA: {p.capaMeasures}</div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>负责人: {p.responsiblePerson}</span>
                  <Badge label={p.status === 'approved' ? '已批准' : p.status === 'rejected' ? '已驳回' : '待审批'} className={p.status === 'approved' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'} />
                  {p.approvedBy && <span>审批人: {p.approvedBy}</span>}
                  {p.approvedAt && <span>审批时间: {p.approvedAt}</span>}
                </div>
              </div>
            ))}
          </Card>

          <Card title="审批记录" icon={<CheckCircle size={18} />}>
            {issue.approvals.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-b last:border-0 py-2 text-sm">
                <span className="text-gray-500">{a.type === 'plan_approval' ? '方案审批' : '延期审批'}</span>
                <span>{a.approver}</span>
                <Badge label={a.decision === 'approved' ? '通过' : '驳回'} className={a.decision === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} />
                <span className="text-gray-400 flex-1">{a.comment}</span>
                <span className="text-xs text-gray-400">{a.createdAt}</span>
              </div>
            ))}
          </Card>

          <Card title="复查记录" icon={<Clock size={18} />}>
            {issue.reinspections.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b last:border-0 py-2 text-sm">
                <span className="text-gray-500">计划: {r.planDate}</span>
                <span>实际: {r.actualDate}</span>
                <Badge label={r.result === 'pass' ? '通过' : r.result === 'fail' ? '未通过' : '待复查'} className={r.result === 'pass' ? 'bg-green-100 text-green-700' : r.result === 'fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'} />
                <span className="text-gray-400 flex-1">{r.notes}</span>
              </div>
            ))}
          </Card>

          <Card title="延期申请" icon={<Clock size={18} />}>
            {issue.extensions.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b last:border-0 py-2 text-sm">
                <span className="flex-1 text-gray-600">{e.reason}</span>
                <span className="text-gray-500">申请截止: {e.requestedDeadline}</span>
                <Badge label={e.status === 'approved' ? '已批准' : e.status === 'rejected' ? '已驳回' : '待审批'} className={e.status === 'approved' ? 'bg-green-100 text-green-700' : e.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'} />
              </div>
            ))}
          </Card>

          {issue.layeredRecords && issue.layeredRecords.length > 0 && (
            <Card title="分层记录" icon={<Layers size={18} />}>
              {issue.layeredRecords.map((lr) => (
                <div key={lr.id} className="border rounded p-3 mb-2 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge label={layeredRecordTypeLabels[lr.type]} className="bg-indigo-100 text-indigo-700" />
                    <Badge label={layeredRecordStatusLabels[lr.status]} className={lr.status === 'approved' ? 'bg-green-100 text-green-700' : lr.status === 'rejected' ? 'bg-red-100 text-red-700' : lr.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'} />
                  </div>
                  <div className="text-gray-700 whitespace-pre-wrap">{lr.content}</div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>提交人: {lr.submittedBy}</span>
                    <span>提交时间: {lr.submittedAt}</span>
                    {lr.reviewedBy && <span>审批人: {lr.reviewedBy}</span>}
                    {lr.reviewedAt && <span>审批时间: {lr.reviewedAt}</span>}
                  </div>
                  {lr.reviewComment && <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">审批意见: {lr.reviewComment}</div>}
                </div>
              ))}
            </Card>
          )}

          {issue.recurrenceLinks && issue.recurrenceLinks.length > 0 && (
            <Card title="复发关联" icon={<RefreshCw size={18} />}>
              {issue.recurrenceLinks.map((rl) => (
                <div key={rl.id} className="border rounded p-3 mb-2 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge label={`第 ${rl.recurrenceRound} 轮`} className="bg-amber-100 text-amber-700" />
                    <Badge label={`相似度 ${rl.similarityScore}%`} className="bg-blue-100 text-blue-700" />
                    <Badge label={`效果得分 ${rl.effectivenessScore}/100`} className={rl.effectivenessScore >= 80 ? 'bg-green-100 text-green-700' : rl.effectivenessScore >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'} />
                  </div>
                  <div className="text-gray-600 mb-1">
                    关联历史: 
                    <button onClick={() => navigate(`/issues/${rl.originalIssueId}`)} className="text-blue-600 hover:underline ml-1 font-mono">
                      {rl.originalIssueId}
                    </button>
                  </div>
                  <div className="text-gray-600 mb-1">对比分析: {rl.comparisonAnalysis}</div>
                  <div className="text-xs text-gray-500">关联人: {rl.linkedBy} · {rl.linkedAt}</div>
                </div>
              ))}
            </Card>
          )}

          {issue.monitoringData && issue.monitoringData.length > 0 && (
            <Card title="监测数据" icon={<Activity size={18} />}>
              {issue.monitoringData.map((md) => (
                <div key={md.id} className="flex items-center gap-3 border-b last:border-0 py-2 text-sm">
                  <Badge label={md.type === 'air_quality' ? '空气质量' : md.type === 'pressure_vessel' ? '压力容器' : '其他'} className="bg-cyan-100 text-cyan-700" />
                  <div className="flex-1">
                    <div className="font-medium">{md.parameter}: {md.value} {md.unit}</div>
                    <div className="text-xs text-gray-500">标准限值: {md.standardLimit} {md.unit}</div>
                  </div>
                  {md.isClosureEvidence && <Badge label="关闭证据" className="bg-emerald-100 text-emerald-700" />}
                  <span className="text-xs text-gray-400">{md.measuredAt}</span>
                </div>
              ))}
            </Card>
          )}

          {issue.clientConfirmations && issue.clientConfirmations.length > 0 && (
            <Card title="客户确认" icon={<Users size={18} />}>
              {issue.clientConfirmations.map((cc) => (
                <div key={cc.id} className="border rounded p-3 mb-2 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{cc.confirmedBy}</span>
                    {cc.isClosureEvidence && <Badge label="关闭证据" className="bg-emerald-100 text-emerald-700" />}
                  </div>
                  <div className="text-gray-600">{cc.confirmationContent}</div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>联系方式: {cc.contactInfo}</span>
                    <span>确认时间: {cc.confirmedAt}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {issue.riskReevaluations && issue.riskReevaluations.length > 0 && (
            <Card title="风险重评记录" icon={<AlertTriangle size={18} />}>
              {issue.riskReevaluations.map((rr) => (
                <div key={rr.id} className="border rounded p-3 mb-2 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge label={`第 ${rr.recurrenceRound} 轮`} className="bg-amber-100 text-amber-700" />
                    <Badge label={rr.result === 'increased' ? '风险升高' : rr.result === 'decreased' ? '风险降低' : '风险不变'} className={rr.result === 'increased' ? 'bg-red-100 text-red-700' : rr.result === 'decreased' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} />
                  </div>
                  <div className="text-gray-600 mb-1">
                    原评分: <span className="font-medium">{rr.previousRiskScore}</span> 
                    → 新评分: <span className="font-medium text-red-600">{rr.newRiskScore}</span>
                    <span className="text-red-500"> (调整 +{rr.adjustmentPoints} 分)</span>
                  </div>
                  <div className="text-gray-500 text-xs mb-1">原因: {rr.reason}</div>
                  {rr.effectivenessComparison && <div className="text-gray-400 text-xs bg-gray-50 p-2 rounded">{rr.effectivenessComparison}</div>}
                  <div className="text-xs text-gray-400 mt-1">重评人: {rr.reevaluatedBy} · {rr.reevaluatedAt}</div>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div>
          <Card title="照片清单" icon={<Camera size={18} />}>
            {(Object.keys(groupedPhotos) as PhotoCategory[]).map((cat) => (
              <div key={cat} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <span>{photoCategoryLabels[cat]}</span>
                <span className="text-gray-500">{groupedPhotos[cat]} 张</span>
              </div>
            ))}
            {Object.keys(groupedPhotos).length === 0 && <p className="text-sm text-gray-400">暂无照片</p>}
          </Card>

          {issue.photos.some(p => p.isClosureEvidence) && (
            <Card title="证据链（不可覆盖）" icon={<Lock size={18} />}>
              {issue.photos.filter(p => p.isClosureEvidence).map((p) => (
                <div key={p.id} className="border rounded p-3 mb-2 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge label={`v${p.evidenceVersion}`} className="bg-indigo-100 text-indigo-700" />
                    <Badge label={photoCategoryLabels[p.category]} className="bg-blue-100 text-blue-700" />
                    {p.isSupplemental && <Badge label="补充证据" className="bg-amber-100 text-amber-700" />}
                  </div>
                  <div className="text-gray-600">{p.description}</div>
                  {p.parentPhotoId && (
                    <div className="text-xs text-gray-500 mt-1">
                      父证据: <span className="font-mono">{p.parentPhotoId}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">{p.uploadedBy} · {p.uploadedAt}</div>
                </div>
              ))}
            </Card>
          )}

          <Card title="审计日志" icon={<History size={18} />}>
            <div className="relative">
              {issue.auditLogs.map((log) => (
                <div key={log.id} className="flex gap-3 pb-4 border-l-2 border-gray-200 ml-2 pl-4 last:border-0">
                  <div className="text-sm">
                    <div className="font-medium">{log.action}</div>
                    <div className="text-gray-500">{log.actor} · {log.role}</div>
                    {log.details && <div className="text-gray-400 text-xs mt-0.5">{log.details}</div>}
                    <div className="text-xs text-gray-400 mt-0.5">{relativeTime(log.timestamp)}</div>
                  </div>
                </div>
              ))}
              {issue.auditLogs.length === 0 && <p className="text-sm text-gray-400">暂无日志</p>}
            </div>
          </Card>

          {(issue.isRecurrent || issue.originalIssueId) && (
            <Card title="关联问题" icon={<Link2 size={18} />}>
              <div className="text-sm">
                <span className="text-gray-500">原问题: </span>
                <button onClick={() => navigate(`/issues/${issue.originalIssueId}`)} className="text-blue-600 hover:underline font-mono">
                  {issue.originalIssueId}
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
