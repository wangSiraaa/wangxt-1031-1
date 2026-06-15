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
export type ApprovalType = 'plan_approval' | 'extension_approval' | 'layered_approval'
export type ExtensionStatus = 'pending' | 'approved' | 'rejected'

export type LayeredRecordType = 'rectification_plan' | 'capa_measures' | 'extension_request' | 'supervisor_approval'
export type LayeredRecordStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ClosureEvidenceType = 'photo' | 'monitoring' | 'client_confirmation'
export type RiskReevaluationResult = 'increased' | 'decreased' | 'unchanged'

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
  involvesWorkStop: boolean
  involvesExternalSupplier: boolean
  regulationUpdate: string | null
  recurrenceRound: number
  closureEvidenceLocked: boolean
}

export interface IssueDetail extends Issue {
  plans: RemediationPlan[]
  reinspections: Reinspection[]
  photos: Photo[]
  approvals: ApprovalRecord[]
  extensions: ExtensionRequest[]
  auditLogs: AuditLog[]
  layeredRecords: LayeredRecord[]
  recurrenceLinks: RecurrenceLink[]
  monitoringData: MonitoringData[]
  clientConfirmations: ClientConfirmation[]
  riskReevaluations: RiskReevaluation[]
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
  isClosureEvidence: boolean
  evidenceVersion: number
  isSupplemental: boolean
  parentPhotoId: string | null
}

export interface LayeredRecord {
  id: string
  issueId: string
  type: LayeredRecordType
  content: string
  submittedBy: string
  submittedAt: string
  status: LayeredRecordStatus
  version: number
  approvedBy: string | null
  approvedAt: string | null
  comment: string | null
}

export interface RecurrenceLink {
  id: string
  issueId: string
  originalIssueId: string
  recurrenceRound: number
  recurrenceDate: string
  comparisonAnalysis: string | null
  riskAdjustment: number
  effectivenessScore: number | null
  linkedBy: string
}

export interface MonitoringData {
  id: string
  issueId: string
  type: string
  value: string
  unit: string | null
  measuredAt: string
  measuredBy: string
  isClosureEvidence: boolean
  notes: string | null
}

export interface ClientConfirmation {
  id: string
  issueId: string
  confirmedBy: string
  confirmedAt: string
  confirmationContent: string
  isClosureEvidence: boolean
  contactInfo: string | null
}

export interface RiskReevaluation {
  id: string
  issueId: string
  previousSeverity: IssueSeverity
  newSeverity: IssueSeverity
  result: RiskReevaluationResult
  reason: string
  reevaluatedBy: string
  reevaluatedAt: string
  adjustmentPoints: number
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

export const LAYERED_RECORD_TYPE_LABELS: Record<LayeredRecordType, string> = {
  rectification_plan: '整改方案',
  capa_measures: 'CAPA措施',
  extension_request: '延期申请',
  supervisor_approval: '主管审批',
}

export const LAYERED_RECORD_STATUS_LABELS: Record<LayeredRecordStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  approved: '已批准',
  rejected: '已驳回',
}

export const CLOSURE_EVIDENCE_TYPE_LABELS: Record<ClosureEvidenceType, string> = {
  photo: '复查照片',
  monitoring: '监测数据',
  client_confirmation: '客户确认',
}
