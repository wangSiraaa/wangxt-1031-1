import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  incrementVersion,
  createAuditLog,
  checkIsOverdue,
  canTransitionStatus,
  calculateRiskDeduction,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { type, status } = req.query
  let records = getCollection<any>('approvalRecords')
  if (type) records = records.filter((r) => r.type === type)
  if (status === 'pending') {
    const pendingPlanIds = filterCollection<any>('remediationPlans', (p) => p.status === 'submitted').map((p) => p.id)
    const pendingExtIds = filterCollection<any>('extensionRequests', (e) => e.status === 'pending').map((e) => e.id)
    records = records.filter((r) => pendingPlanIds.includes(r.id) || pendingExtIds.includes(r.id))
  }
  res.json({ success: true, data: records })
})

router.post('/plan/:planId', (req: Request, res: Response): void => {
  const plan = findInCollection<any>('remediationPlans', req.params.planId)
  if (!plan) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }
  const { decision, comment, approver } = req.body
  if (!decision || !approver) {
    res.status(400).json({ success: false, error: '缺少审批决定或审批人' })
    return
  }
  const issue = findInCollection<any>('issues', plan.issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '关联问题不存在' })
    return
  }
  const targetStatus = decision === 'approved' ? 'in_remediation' : 'assigned'
  if (!canTransitionStatus(issue.status, targetStatus)) {
    res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许转换到 ${targetStatus}` })
    return
  }
  updateInCollection('remediationPlans', req.params.planId, {
    status: decision,
    approvedBy: approver,
    approvedAt: new Date().toISOString(),
  })
  updateInCollection('issues', plan.issueId, {
    status: targetStatus,
    version: incrementVersion(issue),
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === approver)
  const approvalRecord = {
    id: generateId(),
    issueId: plan.issueId,
    type: 'plan_approval',
    approver,
    decision,
    comment: comment || '',
    createdAt: new Date().toISOString(),
  }
  addToCollection('approvalRecords', approvalRecord)
  createAuditLog(
    plan.issueId,
    decision === 'approved' ? 'plan_approved' : 'plan_rejected',
    user?.name || approver,
    'supervisor',
    decision === 'approved' ? `主管审批通过整改方案${comment ? '：' + comment : ''}` : `主管驳回整改方案${comment ? '：' + comment : ''}`,
  )
  res.json({ success: true, data: approvalRecord })
})

router.post('/extension/:extensionId', (req: Request, res: Response): void => {
  const ext = findInCollection<any>('extensionRequests', req.params.extensionId)
  if (!ext) {
    res.status(404).json({ success: false, error: '延期申请不存在' })
    return
  }
  const { decision, comment, approver } = req.body
  if (!decision || !approver) {
    res.status(400).json({ success: false, error: '缺少审批决定或审批人' })
    return
  }
  updateInCollection('extensionRequests', req.params.extensionId, {
    status: decision,
    approvedBy: approver,
  })
  const issue = findInCollection<any>('issues', ext.issueId)
  if (issue) {
    if (decision === 'approved') {
      const newStatus = issue.status === 'overdue' ? 'in_remediation' : issue.status
      if (newStatus !== issue.status && !canTransitionStatus(issue.status, newStatus)) {
        res.status(400).json({ success: false, error: `不允许从 ${issue.status} 转换到 ${newStatus}` })
        return
      }
      updateInCollection('issues', ext.issueId, {
        deadline: ext.requestedDeadline,
        isOverdue: false,
        version: incrementVersion(issue),
        status: newStatus,
      })
    } else {
      if (checkIsOverdue(issue.deadline)) {
        const deduction = calculateRiskDeduction(issue.severity, false)
        updateInCollection('issues', ext.issueId, {
          isOverdue: true,
          status: 'overdue',
          version: incrementVersion(issue),
          riskScoreDeduction: (issue.riskScoreDeduction || 0) + deduction,
        })
        const riskScores = getCollection<any>('riskScores')
        if (riskScores.length > 0) {
          updateInCollection('riskScores', riskScores[0].id, {
            score: riskScores[0].score - deduction,
            updatedAt: new Date().toISOString(),
          })
        }
        const riskDeduction = {
          id: generateId(),
          riskScoreId: riskScores[0]?.id || generateId(),
          issueId: issue.id,
          reason: `延期申请被拒且已过截止日：${issue.title}`,
          points: deduction,
          createdAt: new Date().toISOString(),
        }
        addToCollection('riskDeductions', riskDeduction)
      }
    }
  }
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === approver)
  const approvalRecord = {
    id: generateId(),
    issueId: ext.issueId,
    type: 'extension_approval',
    approver,
    decision,
    comment: comment || '',
    createdAt: new Date().toISOString(),
  }
  addToCollection('approvalRecords', approvalRecord)
  createAuditLog(
    ext.issueId,
    decision === 'approved' ? 'extension_approved' : 'extension_rejected',
    user?.name || approver,
    'supervisor',
    decision === 'approved' ? `延期申请已批准${comment ? '：' + comment : ''}` : `延期申请被拒绝${comment ? '：' + comment : ''}`,
  )
  res.json({ success: true, data: approvalRecord })
})

export default router
