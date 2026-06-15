export type IssueSeverity = 'high' | 'medium' | 'low'
export type IssueStatus =
  | 'submitted'
  | 'assigned'
  | 'plan_submitted'
  | 'in_remediation'
  | 'reinspection_in_progress'
  | 'reinspection_passed'
  | 'overdue'
  | 'reopened'
  | 'closed'

export type PlanStatus = 'submitted' | 'approved' | 'rejected'
export type ReinspectionResult = 'pending' | 'pass' | 'fail'
export type PhotoCategory = 'evidence' | 'remediation' | 'reinspection'
export type ApprovalDecision = 'approved' | 'rejected'
export type ApprovalType = 'plan_approval' | 'extension_approval'
export type ExtensionStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: string
  name: string
  role: 'auditor' | 'responsible' | 'safety' | 'supervisor'
}

export interface Issue {
  id: string
  version: number
  title: string
  regulationClause: string
  severity: IssueSeverity
  description: string
  clientConfirmationRequired: boolean
  status: IssueStatus
  createdAt: string
  deadline: string
  createdBy: string
  assignedTo: string | null
  isOverdue: boolean
  isRecurrent: boolean
  originalIssueId: string | null
  riskScoreDeduction: number
}

export interface IssueDetail extends Issue {
  plans: RemediationPlan[]
  reinspections: Reinspection[]
  photos: Photo[]
  approvals: ApprovalRecord[]
  extensions: ExtensionRequest[]
  auditLogs: AuditLog[]
}

export interface RemediationPlan {
  id: string
  issueId: string
  version: number
  rootCause: string
  plan: string
  capaMeasures: string
  responsiblePerson: string
  deadline: string
  status: PlanStatus
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
}

export interface Reinspection {
  id: string
  issueId: string
  planDate: string
  actualDate: string
  result: ReinspectionResult
  notes: string
  inspector: string
  createdAt: string
}

export interface Photo {
  id: string
  issueId: string
  category: PhotoCategory
  url: string
  uploadedAt: string
  uploadedBy: string
}

export interface ApprovalRecord {
  id: string
  issueId: string
  type: ApprovalType
  approver: string
  approverRole?: string
  approverName?: string
  decision: ApprovalDecision
  comment: string
  createdAt: string
}

export interface ExtensionRequest {
  id: string
  issueId: string
  reason: string
  requestedDeadline: string
  status: ExtensionStatus
  approvedBy: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  issueId: string
  action: string
  actor: string
  role: string
  details: string
  timestamp: string
}

export interface RiskScore {
  id: string
  score: number
  updatedAt: string
}

export interface RiskDeduction {
  id: string
  riskScoreId: string
  issueId: string
  reason: string
  points: number
  createdAt: string
}

export const STATUS_LABELS: Record<IssueStatus, string> = {
  submitted: '已提交',
  assigned: '已分派',
  plan_submitted: '待审批',
  in_remediation: '整改中',
  reinspection_in_progress: '复查中',
  reinspection_passed: '复查通过',
  overdue: '逾期',
  reopened: '已重开',
  closed: '已关闭',
}

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
}

export const ROLE_LABELS: Record<string, string> = {
  auditor: '审厂员',
  responsible: '企业负责人',
  safety: '安全专员',
  supervisor: '主管',
}
