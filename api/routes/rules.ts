import { Router, type Request, type Response } from 'express'
import { findInCollection } from '../lib/db.js'
import {
  getBusinessRulesSummary,
  processOverdueIssues,
  canCloseIssue,
  canStartReinspection,
  checkIsOverdue,
  getOverdueDays,
  checkReinspectionPhotosComplete,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const rules = getBusinessRulesSummary()
  res.json({ success: true, data: rules })
})

router.post('/process-overdue', (_req: Request, res: Response): void => {
  const result = processOverdueIssues()
  res.json({
    success: true,
    data: {
      updated: result.updated,
      deductions: result.deductions,
      message: result.updated > 0
        ? `已处理 ${result.updated} 个逾期问题，共扣减 ${result.deductions} 风险分`
        : '无新逾期问题',
    },
  })
})

router.get('/can-close/:issueId', (req: Request, res: Response): void => {
  const { issueId } = req.params
  const result = canCloseIssue(issueId)
  res.json({ success: true, data: result })
})

router.get('/can-reinspect/:issueId', (req: Request, res: Response): void => {
  const { issueId } = req.params
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const result = canStartReinspection(issue)
  res.json({ success: true, data: result })
})

router.get('/overdue-status/:issueId', (req: Request, res: Response): void => {
  const { issueId } = req.params
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const isOverdue = checkIsOverdue(issue.deadline)
  const overdueDays = getOverdueDays(issue.deadline)
  const hasPhotos = checkReinspectionPhotosComplete(issueId)
  res.json({
    success: true,
    data: {
      isOverdue,
      overdueDays,
      hasReinspectionPhotos: hasPhotos,
      deadline: issue.deadline,
    },
  })
})

export default router
