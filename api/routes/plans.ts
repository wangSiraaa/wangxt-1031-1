import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  incrementVersion,
  createAuditLog,
  checkHighRiskApprovalRequired,
  canTransitionStatus,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId } = req.query
  let plans = getCollection<any>('remediationPlans')
  if (issueId) plans = plans.filter((p) => p.issueId === issueId)
  res.json({ success: true, data: plans })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, rootCause, plan, capaMeasures, responsiblePerson, deadline, createdBy } = req.body
  if (!issueId || !rootCause || !plan || !capaMeasures || !createdBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const needsApproval = checkHighRiskApprovalRequired(issue.severity)
  const targetStatus = needsApproval ? 'plan_submitted' : 'in_remediation'
  if (!canTransitionStatus(issue.status, targetStatus)) {
    res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许提交方案` })
    return
  }
  const existingPlans = filterCollection<any>('remediationPlans', (p) => p.issueId === issueId)
  const version = existingPlans.length > 0 ? Math.max(...existingPlans.map((p) => p.version)) + 1 : 1
  const newPlan = {
    id: generateId(),
    issueId,
    version,
    rootCause,
    plan,
    capaMeasures,
    responsiblePerson: responsiblePerson || createdBy,
    deadline: deadline || issue.deadline,
    status: needsApproval ? 'submitted' : 'approved',
    approvedBy: needsApproval ? null : createdBy,
    approvedAt: needsApproval ? null : new Date().toISOString(),
    createdBy,
    createdAt: new Date().toISOString(),
  }
  addToCollection('remediationPlans', newPlan)
  updateInCollection('issues', issueId, {
    status: targetStatus,
    version: incrementVersion(issue),
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === createdBy)
  createAuditLog(
    issueId,
    needsApproval ? 'plan_submitted' : 'plan_auto_approved',
    user?.name || createdBy,
    user?.role || 'responsible',
    needsApproval ? `提交整改方案，因高风险需主管审批` : `提交整改方案，非高风险自动通过`,
  )
  res.status(201).json({ success: true, data: newPlan })
})

router.put('/:id', (req: Request, res: Response): void => {
  const plan = findInCollection<any>('remediationPlans', req.params.id)
  if (!plan) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }
  const updates = { ...req.body, version: incrementVersion(plan) }
  delete updates.id
  delete updates.issueId
  delete updates.createdAt
  delete updates.createdBy
  const updated = updateInCollection('remediationPlans', req.params.id, updates)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === req.body.updatedBy)
  createAuditLog(
    plan.issueId,
    'plan_updated',
    user?.name || req.body.updatedBy || '系统',
    user?.role || 'system',
    `更新整改方案`,
  )
  res.json({ success: true, data: updated })
})

export default router
