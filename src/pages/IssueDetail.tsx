import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle, Clock, Camera, History, Link2 } from 'lucide-react'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'
import type { IssueSeverity, IssueStatus, PhotoCategory } from '@/types'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'

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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="基本信息" icon={<FileText size={18} />}>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500 w-24 inline-block">标题</span>{issue.title}</div>
              <div><span className="text-gray-500 w-24 inline-block">法规条款</span>{issue.regulationClause}</div>
              <div><span className="text-gray-500 w-24 inline-block">描述</span>{issue.description}</div>
              <div><span className="text-gray-500 w-24 inline-block">客户确认</span>{issue.clientConfirmationRequired ? '是' : '否'}</div>
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
