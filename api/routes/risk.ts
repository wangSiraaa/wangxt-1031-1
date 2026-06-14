import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, updateInCollection, addToCollection, generateId } from '../lib/db.js'
import {
  incrementVersion,
  createAuditLog,
  canCloseIssue,
  canTransitionStatus,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const scores = getCollection<any>('riskScores')
  const deductions = getCollection<any>('riskDeductions')
  res.json({ success: true, data: { scores, deductions } })
})

router.post('/close-issue/:issueId', (req: Request, res: Response): void => {
  const issue = findInCollection<any>('issues', req.params.issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const canClose = canCloseIssue(req.params.issueId)
  if (!canClose.allowed) {
    res.status(400).json({ success: false, error: canClose.reason })
    return
  }
  if (!canTransitionStatus(issue.status, 'closed')) {
    res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许关闭` })
    return
  }
  const updated = updateInCollection('issues', req.params.issueId, {
    status: 'closed',
    version: incrementVersion(issue),
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === req.body.closedBy)
  createAuditLog(
    req.params.issueId,
    'issue_closed',
    user?.name || req.body.closedBy || '系统',
    user?.role || 'safety',
    `问题关闭，整改完成`,
  )
  res.json({ success: true, data: updated })
})

export default router
