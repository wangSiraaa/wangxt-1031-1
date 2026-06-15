import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  incrementVersion,
  createAuditLog,
  calculateRiskDeduction,
  checkIsOverdue,
  canTransitionStatus,
  validateHighRiskToRemediation,
  createUnauthorizedAuditLog,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const issues = getCollection<any>('issues')
  const { status, severity, overdue, search } = req.query
  let filtered = [...issues]
  if (status) filtered = filtered.filter((i) => i.status === status)
  if (severity) filtered = filtered.filter((i) => i.severity === severity)
  if (overdue === 'true') filtered = filtered.filter((i) => i.isOverdue)
  if (search) {
    const q = String(search).toLowerCase()
    filtered = filtered.filter(
      (i) => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.regulationClause.toLowerCase().includes(q)
    )
  }
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  res.json({ success: true, data: filtered })
})

router.get('/:id', (req: Request, res: Response): void => {
  const issue = findInCollection<any>('issues', req.params.id)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const plans = filterCollection<any>('remediationPlans', (p) => p.issueId === issue.id)
  const reinspections = filterCollection<any>('reinspections', (r) => r.issueId === issue.id)
  const photos = filterCollection<any>('photos', (p) => p.issueId === issue.id)
  const approvals = filterCollection<any>('approvalRecords', (a) => a.issueId === issue.id)
  const extensions = filterCollection<any>('extensionRequests', (e) => e.issueId === issue.id)
  const auditLogs = filterCollection<any>('auditLogs', (a) => a.issueId === issue.id)
  res.json({
    success: true,
    data: {
      ...issue,
      plans,
      reinspections,
      photos,
      approvals,
      extensions,
      auditLogs,
    },
  })
})

router.post('/', (req: Request, res: Response): void => {
  const { title, regulationClause, severity, description, clientConfirmationRequired, deadline, createdBy } = req.body
  if (!title || !severity || !description || !createdBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issues = getCollection<any>('issues')
  const num = String(issues.length + 1).padStart(3, '0')
  const riskDeduction = calculateRiskDeduction(severity, false)
  const issue = {
    id: `ISS-${num}`,
    version: 1,
    title,
    regulationClause: regulationClause || '',
    severity,
    description,
    clientConfirmationRequired: !!clientConfirmationRequired,
    status: 'submitted',
    createdAt: new Date().toISOString(),
    deadline: deadline || new Date(Date.now() + 15 * 86400000).toISOString(),
    createdBy,
    assignedTo: null,
    isOverdue: false,
    isRecurrent: false,
    originalIssueId: null,
    riskScoreDeduction: riskDeduction,
  }
  addToCollection('issues', issue)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === createdBy)
  const deduction = {
    id: generateId(),
    riskScoreId: getCollection<any>('riskScores')[0]?.id || generateId(),
    issueId: issue.id,
    reason: `${title} (${severity}级)`,
    points: riskDeduction,
    createdAt: new Date().toISOString(),
  }
  addToCollection('riskDeductions', deduction)
  const riskScores = getCollection<any>('riskScores')
  if (riskScores.length > 0) {
    updateInCollection('riskScores', riskScores[0].id, {
      score: riskScores[0].score - riskDeduction,
      updatedAt: new Date().toISOString(),
    })
  }
  createAuditLog(
    issue.id,
    'issue_created',
    user?.name || createdBy,
    user?.role || 'auditor',
    `创建${severity === 'high' ? '高风险' : severity === 'medium' ? '中风险' : '低风险'}问题：${title}`,
  )
  res.status(201).json({ success: true, data: issue })
})

router.put('/:id', (req: Request, res: Response): void => {
  const issue = findInCollection<any>('issues', req.params.id)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const newStatus = req.body.status
  if (newStatus && newStatus !== issue.status) {
    if (!canTransitionStatus(issue.status, newStatus)) {
      res.status(400).json({ success: false, error: `不允许从 ${issue.status} 状态转换到 ${newStatus}` })
      return
    }
    if (newStatus === 'in_remediation') {
      const actorId = req.body.updatedBy || req.body.assignedTo
      const gateResult = validateHighRiskToRemediation(req.params.id, newStatus, actorId)
      if (!gateResult.allowed) {
        const users = getCollection<any>('users')
        const actor = actorId ? users.find((u: any) => u.id === actorId) : null
        createUnauthorizedAuditLog(
          req.params.id,
          'high_risk_bypass_blocked',
          actor?.name || actorId || 'unknown',
          actor?.role || 'unknown',
          `尝试将高风险问题直接推进到整改中，被审批门控拦截：${gateResult.reason}`,
        )
        res.status(403).json({ success: false, error: gateResult.reason })
        return
      }
    }
  }
  const updates = { ...req.body, version: incrementVersion(issue) }
  delete updates.id
  delete updates.createdAt
  delete updates.createdBy
  const updated = updateInCollection('issues', req.params.id, updates)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === req.body.updatedBy)
  createAuditLog(
    req.params.id,
    'issue_updated',
    user?.name || req.body.updatedBy || '系统',
    user?.role || 'system',
    `更新问题信息`,
  )
  res.json({ success: true, data: updated })
})

router.put('/:id/assign', (req: Request, res: Response): void => {
  const issue = findInCollection<any>('issues', req.params.id)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  if (!canTransitionStatus(issue.status, 'assigned')) {
    res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许分派` })
    return
  }
  const { assignedTo } = req.body
  if (!assignedTo) {
    res.status(400).json({ success: false, error: '请指定负责人' })
    return
  }
  const updated = updateInCollection('issues', req.params.id, {
    assignedTo,
    status: 'assigned',
    version: incrementVersion(issue),
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === assignedTo)
  createAuditLog(
    req.params.id,
    'issue_assigned',
    user?.name || assignedTo,
    user?.role || 'responsible',
    `问题已分派给${user?.name || assignedTo}`,
  )
  res.json({ success: true, data: updated })
})

router.post('/:id/reopen', (req: Request, res: Response): void => {
  const issue = findInCollection<any>('issues', req.params.id)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  if (!canTransitionStatus(issue.status, 'reopened')) {
    res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许重开` })
    return
  }
  const { originalIssueId, reopenedBy } = req.body
  const reopenPoints = calculateRiskDeduction(issue.severity, true)
  const updated = updateInCollection('issues', req.params.id, {
    status: 'reopened',
    isRecurrent: true,
    originalIssueId: originalIssueId || issue.id,
    version: incrementVersion(issue),
  })
  const deduction = {
    id: generateId(),
    riskScoreId: getCollection<any>('riskScores')[0]?.id || generateId(),
    issueId: req.params.id,
    reason: `问题复发扣分：${issue.title}`,
    points: reopenPoints,
    createdAt: new Date().toISOString(),
  }
  addToCollection('riskDeductions', deduction)
  const riskScores = getCollection<any>('riskScores')
  if (riskScores.length > 0) {
    updateInCollection('riskScores', riskScores[0].id, {
      score: riskScores[0].score - reopenPoints,
      updatedAt: new Date().toISOString(),
    })
  }
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === reopenedBy)
  createAuditLog(
    req.params.id,
    'issue_reopened',
    user?.name || reopenedBy,
    user?.role || 'auditor',
    `重新打开问题（复发），扣减风险分${reopenPoints}分`,
  )
  res.json({ success: true, data: updated })
})

export default router
