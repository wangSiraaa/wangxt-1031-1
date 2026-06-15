import { getCollection, findInCollection, updateInCollection, addToCollection, generateId, filterCollection } from '../lib/db.js'

export const RULES = {
  R001: '高风险方案审批门控',
  R002: '照片缺失关闭拦截',
  R003: '逾期自动标记',
  R004: '逾期风险扣分',
  R005: '复发重开扣分',
  R006: '延期驳回即逾期',
  R007: '审计不可变',
  R008: '版本递增',
  R009: '主管角色校验',
  R010: '高风险分层记录完整性',
  R011: '半年内复发自动关联',
  R012: '关闭证据不可覆盖',
  R013: '复发问题风险重评',
  R014: '高风险升级检测',
} as const

export const RECURRENCE_DETECTION_WINDOW_DAYS = 180
export const HIGH_RISK_ESCALATION_DEDUCTION = 30

export const ROLE_LABELS: Record<string, string> = {
  auditor: '审厂员',
  responsible: '企业负责人',
  safety: '安全专员',
  supervisor: '主管',
}

export const SEVERITY_DEDUCTION: Record<string, number> = {
  high: 20,
  medium: 10,
  low: 5,
}

export function checkHighRiskApprovalRequired(severity: string): boolean {
  return severity === 'high'
}

export function checkReinspectionPhotosComplete(issueId: string): boolean {
  const photos = getCollection<any>('photos')
  const reinspectionPhotos = photos.filter(
    (p: any) => p.issueId === issueId && p.category === 'reinspection'
  )
  return reinspectionPhotos.length > 0
}

export function checkIsOverdue(deadline: string): boolean {
  const now = Date.now()
  const deadlineTime = new Date(deadline).getTime()
  return now > deadlineTime
}

export function getOverdueDays(deadline: string): number {
  const now = Date.now()
  const deadlineTime = new Date(deadline).getTime()
  if (now <= deadlineTime) return 0
  return Math.floor((now - deadlineTime) / 86400000)
}

export function calculateRiskDeduction(severity: string, isRecurrent: boolean = false): number {
  const base = SEVERITY_DEDUCTION[severity] || 5
  return isRecurrent ? base * 2 : base
}

export function processOverdueIssues(): { updated: number; deductions: number } {
  const issues = getCollection<any>('issues')
  const riskScores = getCollection<any>('riskScores')
  const now = new Date().toISOString()
  let updatedCount = 0
  let totalDeductions = 0

  for (const issue of issues) {
    if (issue.status === 'closed') continue
    if (checkIsOverdue(issue.deadline) && !issue.isOverdue) {
      const deduction = calculateRiskDeduction(issue.severity, false)
      updateInCollection('issues', issue.id, {
        isOverdue: true,
        status: 'overdue',
        version: issue.version + 1,
        riskScoreDeduction: (issue.riskScoreDeduction || 0) + deduction,
      })
      if (riskScores.length > 0) {
        updateInCollection('riskScores', riskScores[0].id, {
          score: riskScores[0].score - deduction,
          updatedAt: now,
        })
      }
      const riskDeduction = {
        id: generateId(),
        riskScoreId: riskScores[0]?.id || generateId(),
        issueId: issue.id,
        reason: `问题逾期：${issue.title}`,
        points: deduction,
        createdAt: now,
      }
      addToCollection('riskDeductions', riskDeduction)
      const auditLog = {
        id: generateId(),
        issueId: issue.id,
        action: 'issue_overdue',
        actor: '系统',
        role: 'system',
        details: getOverdueDays(issue.deadline) > 7
          ? '问题逾期超过7天，严重等级升级'
          : '问题已逾期，加入红名单',
        timestamp: now,
      }
      addToCollection('auditLogs', auditLog)
      updatedCount++
      totalDeductions += deduction
    }
  }
  return { updated: updatedCount, deductions: totalDeductions }
}

export function canCloseIssue(issueId: string): { allowed: boolean; reason?: string } {
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) return { allowed: false, reason: '问题不存在' }
  if (issue.status !== 'reinspection_passed') {
    return { allowed: false, reason: '问题未通过复查' }
  }
  if (!checkReinspectionPhotosComplete(issueId)) {
    return { allowed: false, reason: '复查照片缺失，无法关闭问题' }
  }
  return { allowed: true }
}

export function canStartReinspection(issue: any): { allowed: boolean; reason?: string } {
  const allowedStatuses = ['in_remediation', 'reopened']
  if (!allowedStatuses.includes(issue.status)) {
    return { allowed: false, reason: '问题状态不允许复查' }
  }
  if (issue.severity === 'high') {
    const plans = filterCollection<any>('remediationPlans', (p) => p.issueId === issue.id)
    const approvedPlan = plans.find((p) => p.status === 'approved')
    if (!approvedPlan) {
      return { allowed: false, reason: '高风险问题需主管审批方案后才能复查' }
    }
  }
  return { allowed: true }
}

export function validatePlanTransition(issue: any, planStatus: string): { allowed: boolean; reason?: string } {
  if (issue.severity === 'high' && planStatus !== 'approved') {
    return { allowed: false, reason: '高风险方案必须经主管审批' }
  }
  return { allowed: true }
}

export function createAuditLog(
  issueId: string,
  action: string,
  actor: string,
  role: string,
  details: string
): any {
  const log = {
    id: generateId(),
    issueId,
    action,
    actor,
    role,
    details,
    timestamp: new Date().toISOString(),
  }
  addToCollection('auditLogs', log)
  return log
}

export function incrementVersion(entity: any): number {
  return (entity.version || 0) + 1
}

export function getStatusTransitionRules(): Record<string, string[]> {
  return {
    submitted: ['assigned'],
    assigned: ['plan_submitted', 'in_remediation'],
    plan_submitted: ['in_remediation', 'assigned'],
    in_remediation: ['reinspection_in_progress', 'overdue'],
    reinspection_in_progress: ['reinspection_passed', 'assigned', 'overdue'],
    reinspection_passed: ['closed', 'overdue'],
    overdue: ['in_remediation', 'closed'],
    reopened: ['in_remediation', 'reinspection_in_progress'],
    closed: ['reopened'],
  }
}

export function canTransitionStatus(currentStatus: string, targetStatus: string): boolean {
  const rules = getStatusTransitionRules()
  const allowed = rules[currentStatus] || []
  return allowed.includes(targetStatus)
}

export function validateHighRiskToRemediation(issueId: string, targetStatus: string, actorId?: string): { allowed: boolean; reason?: string } {
  if (targetStatus !== 'in_remediation') return { allowed: true }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) return { allowed: false, reason: '问题不存在' }
  if (issue.severity !== 'high') return { allowed: true }
  const plans = filterCollection<any>('remediationPlans', (p) => p.issueId === issueId)
  const approvedPlan = plans.find((p) => p.status === 'approved')
  if (!approvedPlan) {
    return { allowed: false, reason: '高风险问题必须经主管审批整改方案后才能进入整改（R001）' }
  }
  if (actorId) {
    const users = getCollection<any>('users')
    const actor = users.find((u: any) => u.id === actorId)
    if (actor && actor.role !== 'supervisor' && !approvedPlan.approvedBy) {
      return { allowed: false, reason: `用户 ${actor.name}（${actor.role}）无权将高风险问题推进到整改中，需主管审批（R001）` }
    }
  }
  return { allowed: true }
}

export function validateSupervisorRole(userId: string): { allowed: boolean; user?: any; reason?: string } {
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === userId)
  if (!user) {
    return { allowed: false, reason: '用户不存在' }
  }
  if (user.role !== 'supervisor') {
    return { allowed: false, user, reason: `用户 ${user.name}（${ROLE_LABELS[user.role] || user.role}）无主管审批权限，仅主管角色可执行审批操作（R009）` }
  }
  return { allowed: true, user }
}

export function createUnauthorizedAuditLog(
  issueId: string,
  action: string,
  actor: string,
  role: string,
  details: string
): any {
  return createAuditLog(issueId, action, actor, role, `【越权拦截】${details}`)
}

export function getBusinessRulesSummary(): any[] {
  return [
    { id: 'R001', name: RULES.R001, description: 'severity=high 的方案必须 supervisor 审批通过才能进入 in_remediation' },
    { id: 'R002', name: RULES.R002, description: '关闭问题时必须存在 category=reinspection 的照片记录' },
    { id: 'R003', name: RULES.R003, description: 'deadline < now() 时自动标记 isOverdue=true，加入红色清单' },
    { id: 'R004', name: RULES.R004, description: '逾期问题按 severity 扣减风险评分（high:20, medium:10, low:5）' },
    { id: 'R005', name: RULES.R005, description: '重开问题时额外扣减风险评分（按原问题 severity 的2倍）' },
    { id: 'R006', name: RULES.R006, description: '延期申请被驳回后，若已过原 deadline 则立即进入逾期' },
    { id: 'R007', name: RULES.R007, description: 'auditLogs 表仅追加，不修改不删除' },
    { id: 'R008', name: RULES.R008, description: '问题/方案更新时 version+1，保留历史版本' },
    { id: 'R009', name: RULES.R009, description: '仅 role=supervisor 的用户可执行审批操作（方案审批/延期审批）' },
    { id: 'R010', name: RULES.R010, description: '高风险问题牵涉停工/外协/法规更新时，整改方案、CAPA措施、延期申请、主管审批必须分层记录' },
    { id: 'R011', name: RULES.R011, description: '同类问题在半年内重复出现时，自动关联历史轮次，对比整改效果' },
    { id: 'R012', name: RULES.R012, description: '复查照片、监测数据和客户确认一旦作为关闭依据提交，只能追加补证，不能覆盖原证据' },
    { id: 'R013', name: RULES.R013, description: '复发问题需重新评估风险等级，拉低风险评分' },
    { id: 'R014', name: RULES.R014, description: '高风险问题牵涉停工、外协供应商和法规条款更新时触发自动升级' },
  ]
}

export function checkHighRiskEscalationRequired(issue: any): { required: boolean; reason?: string } {
  if (issue.severity !== 'high') return { required: false }
  const triggers = []
  if (issue.involvesWorkStop) triggers.push('牵涉停工')
  if (issue.involvesExternalSupplier) triggers.push('牵涉外协供应商')
  if (issue.regulationUpdate) triggers.push('法规条款更新')
  if (triggers.length > 0) {
    return { required: true, reason: `高风险问题${triggers.join('、')}，需按R010/R014分层记录并升级审批` }
  }
  return { required: false }
}

export function checkLayeredRecordsComplete(issueId: string): { complete: boolean; missing: string[] } {
  const layeredRecords = filterCollection<any>('layeredRecords', (r) => r.issueId === issueId && r.status === 'approved')
  const requiredTypes = ['rectification_plan', 'capa_measures', 'supervisor_approval']
  const existingTypes = new Set(layeredRecords.map((r) => r.type))
  const missing = requiredTypes.filter((t) => !existingTypes.has(t))
  return { complete: missing.length === 0, missing }
}

export function findSimilarIssuesWithinWindow(
  issue: any,
  windowDays: number = RECURRENCE_DETECTION_WINDOW_DAYS
): any[] {
  const issues = getCollection<any>('issues')
  const now = Date.now()
  const windowMs = windowDays * 86400000
  return issues.filter((i) => {
    if (i.id === issue.id) return false
    if (i.status === 'submitted') return false
    const createdTime = new Date(i.createdAt).getTime()
    const ageMs = now - createdTime
    if (ageMs > windowMs) return false
    const titleSimilar =
      i.title.toLowerCase().includes(issue.title.toLowerCase()) ||
      issue.title.toLowerCase().includes(i.title.toLowerCase())
    const regulationSimilar = i.regulationClause === issue.regulationClause
    const descSimilar =
      i.description.toLowerCase().includes(issue.description.substring(0, 20).toLowerCase()) ||
      issue.description.toLowerCase().includes(i.description.substring(0, 20).toLowerCase())
    return titleSimilar || regulationSimilar || descSimilar
  })
}

export function createRecurrenceLink(
  issueId: string,
  originalIssueId: string,
  linkedBy: string,
  comparisonAnalysis?: string
): any {
  const existingLinks = filterCollection<any>('recurrenceLinks', (l) => l.originalIssueId === originalIssueId)
  const recurrenceRound = existingLinks.length + 1
  const link = {
    id: generateId(),
    issueId,
    originalIssueId,
    recurrenceRound,
    recurrenceDate: new Date().toISOString(),
    comparisonAnalysis: comparisonAnalysis || null,
    riskAdjustment: 0,
    effectivenessScore: null,
    linkedBy,
  }
  addToCollection('recurrenceLinks', link)
  return link
}

export function checkClosureEvidenceLocked(issueId: string): { locked: boolean; evidence?: any[] } {
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) return { locked: false }
  if (issue.closureEvidenceLocked) {
    const photos = filterCollection<any>('photos', (p) => p.issueId === issueId && p.isClosureEvidence)
    const monitoring = filterCollection<any>('monitoringData', (m) => m.issueId === issueId && m.isClosureEvidence)
    const confirmations = filterCollection<any>(
      'clientConfirmations',
      (c) => c.issueId === issueId && c.isClosureEvidence
    )
    return { locked: true, evidence: [...photos, ...monitoring, ...confirmations] }
  }
  return { locked: false }
}

export function canModifyEvidence(issueId: string, evidenceId: string): { allowed: boolean; reason?: string } {
  const lockCheck = checkClosureEvidenceLocked(issueId)
  if (!lockCheck.locked) return { allowed: true }
  const photos = filterCollection<any>('photos', (p) => p.issueId === issueId && p.isClosureEvidence)
  const monitoring = filterCollection<any>('monitoringData', (m) => m.issueId === issueId && m.isClosureEvidence)
  const confirmations = filterCollection<any>(
    'clientConfirmations',
    (c) => c.issueId === issueId && c.isClosureEvidence
  )
  const allEvidence = [...photos, ...monitoring, ...confirmations]
  const isLockedEvidence = allEvidence.some((e) => e.id === evidenceId)
  if (isLockedEvidence) {
    return { allowed: false, reason: '此证据已作为关闭依据锁定，仅可追加补证，不可修改或删除（R012）' }
  }
  return { allowed: true }
}

export function calculateEffectivenessScore(originalIssue: any, recurrentIssue: any): number {
  const originalDays = Math.max(
    1,
    Math.ceil((new Date(originalIssue.deadline).getTime() - new Date(originalIssue.createdAt).getTime()) / 86400000)
  )
  const recurrentDays = Math.max(
    1,
    Math.ceil((new Date(recurrentIssue.deadline).getTime() - new Date(recurrentIssue.createdAt).getTime()) / 86400000)
  )
  const timeRatio = Math.min(1, recurrentDays / originalDays)
  const severityWeight = originalIssue.severity === 'high' ? 1.5 : originalIssue.severity === 'medium' ? 1 : 0.5
  const baseScore = 100 - (timeRatio * 50 + severityWeight * 20)
  return Math.max(0, Math.min(100, Math.round(baseScore)))
}

export function reevaluateRiskForRecurrence(
  issueId: string,
  recurrenceRound: number,
  reevaluatedBy: string
): { previousSeverity: string; newSeverity: string; adjustmentPoints: number } {
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) throw new Error('问题不存在')
  const previousSeverity = issue.severity
  let newSeverity = previousSeverity
  let adjustmentPoints = 0
  if (recurrenceRound >= 3) {
    newSeverity = 'high'
    adjustmentPoints = SEVERITY_DEDUCTION['high'] * 2
  } else if (recurrenceRound === 2) {
    if (previousSeverity === 'low') newSeverity = 'medium'
    else if (previousSeverity === 'medium') newSeverity = 'high'
    adjustmentPoints = calculateRiskDeduction(previousSeverity, true)
  }
  const riskScores = getCollection<any>('riskScores')
  if (riskScores.length > 0) {
    updateInCollection('riskScores', riskScores[0].id, {
      score: riskScores[0].score - adjustmentPoints,
      updatedAt: new Date().toISOString(),
    })
  }
  const reevaluation = {
    id: generateId(),
    issueId,
    previousSeverity,
    newSeverity,
    result: newSeverity !== previousSeverity ? (newSeverity === 'high' ? 'increased' : 'decreased') : 'unchanged',
    reason: `问题第${recurrenceRound}次复发，按R013重新评估风险等级`,
    reevaluatedBy,
    reevaluatedAt: new Date().toISOString(),
    adjustmentPoints,
  }
  addToCollection('riskReevaluations', reevaluation)
  updateInCollection('issues', issueId, {
    severity: newSeverity,
    riskScoreDeduction: (issue.riskScoreDeduction || 0) + adjustmentPoints,
    version: incrementVersion(issue),
  })
  const deduction = {
    id: generateId(),
    riskScoreId: riskScores[0]?.id || generateId(),
    issueId,
    reason: `复发风险重评：${previousSeverity}→${newSeverity}`,
    points: adjustmentPoints,
    createdAt: new Date().toISOString(),
  }
  addToCollection('riskDeductions', deduction)
  createAuditLog(
    issueId,
    'risk_reevaluated',
    reevaluatedBy,
    'supervisor',
    `风险等级由${previousSeverity}重新评估为${newSeverity}，扣减${adjustmentPoints}分（R013）`
  )
  return { previousSeverity, newSeverity, adjustmentPoints }
}

export function createLayeredRecord(
  issueId: string,
  type: string,
  content: string,
  submittedBy: string
): any {
  const existing = filterCollection<any>('layeredRecords', (r) => r.issueId === issueId && r.type === type)
  const version = existing.length > 0 ? Math.max(...existing.map((r) => r.version)) + 1 : 1
  const record = {
    id: generateId(),
    issueId,
    type,
    content,
    submittedBy,
    submittedAt: new Date().toISOString(),
    status: 'submitted',
    version,
    approvedBy: null,
    approvedAt: null,
    comment: null,
  }
  addToCollection('layeredRecords', record)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === submittedBy)
  const typeLabels: Record<string, string> = {
    rectification_plan: '整改方案',
    capa_measures: 'CAPA措施',
    extension_request: '延期申请',
    supervisor_approval: '主管审批',
  }
  createAuditLog(
    issueId,
    'layered_record_submitted',
    user?.name || submittedBy,
    user?.role || 'responsible',
    `提交分层记录-${typeLabels[type] || type}（R010）`
  )
  return record
}

export function getRecurrenceHistory(originalIssueId: string): any[] {
  const links = filterCollection<any>('recurrenceLinks', (l) => l.originalIssueId === originalIssueId)
  const history = links.map((link) => {
    const issue = findInCollection<any>('issues', link.issueId)
    return {
      ...link,
      issue,
    }
  })
  return history.sort((a, b) => a.recurrenceRound - b.recurrenceRound)
}

export function getIssueRecurrenceRound(issueId: string): number {
  const links = filterCollection<any>('recurrenceLinks', (l) => l.issueId === issueId)
  return links.length > 0 ? Math.max(...links.map((l) => l.recurrenceRound)) : 0
}
