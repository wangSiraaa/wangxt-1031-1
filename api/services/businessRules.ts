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
} as const

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
    { id: 'R009', name: '主管角色校验', description: '仅 role=supervisor 的用户可执行审批操作（方案审批/延期审批）' },
  ]
}
