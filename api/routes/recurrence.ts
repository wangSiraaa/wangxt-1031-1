import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  createAuditLog,
  findSimilarIssuesWithinWindow,
  createRecurrenceLink,
  getRecurrenceHistory,
  reevaluateRiskForRecurrence,
  calculateEffectivenessScore,
  getIssueRecurrenceRound,
} from '../services/businessRules.js'

const router = Router()

router.get('/similar/:issueId', (req: Request, res: Response): void => {
  const issue = findInCollection<any>('issues', req.params.issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const { windowDays } = req.query
  const similar = findSimilarIssuesWithinWindow(issue, windowDays ? Number(windowDays) : undefined)
  res.json({ success: true, data: similar, count: similar.length })
})

router.post('/link', (req: Request, res: Response): void => {
  const { issueId, originalIssueId, linkedBy, comparisonAnalysis } = req.body
  if (!issueId || !originalIssueId || !linkedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  const original = findInCollection<any>('issues', originalIssueId)
  if (!issue || !original) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const link = createRecurrenceLink(issueId, originalIssueId, linkedBy, comparisonAnalysis)
  const currentRound = getIssueRecurrenceRound(issueId)
  updateInCollection('issues', issueId, {
    isRecurrent: true,
    originalIssueId,
    recurrenceRound: currentRound,
    version: issue.version + 1,
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === linkedBy)
  createAuditLog(
    issueId,
    'recurrence_linked',
    user?.name || linkedBy,
    user?.role || 'auditor',
    `关联原始问题${originalIssueId}，为第${currentRound}次复发（R011）`
  )
  res.status(201).json({ success: true, data: { link, recurrenceRound: currentRound } })
})

router.get('/history/:originalIssueId', (req: Request, res: Response): void => {
  const history = getRecurrenceHistory(req.params.originalIssueId)
  res.json({ success: true, data: history, count: history.length })
})

router.post('/reevaluate', (req: Request, res: Response): void => {
  const { issueId, recurrenceRound, reevaluatedBy } = req.body
  if (!issueId || !recurrenceRound || !reevaluatedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  try {
    const result = reevaluateRiskForRecurrence(issueId, Number(recurrenceRound), reevaluatedBy)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.get('/effectiveness/:originalIssueId/:recurrentIssueId', (req: Request, res: Response): void => {
  const { originalIssueId, recurrentIssueId } = req.params
  const original = findInCollection<any>('issues', originalIssueId)
  const recurrent = findInCollection<any>('issues', recurrentIssueId)
  if (!original || !recurrent) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const score = calculateEffectivenessScore(original, recurrent)
  const links = filterCollection<any>('recurrenceLinks', (l) => l.issueId === recurrentIssueId)
  if (links.length > 0) {
    updateInCollection('recurrenceLinks', links[0].id, {
      effectivenessScore: score,
    })
  }
  res.json({
    success: true,
    data: {
      effectivenessScore: score,
      originalDays: Math.ceil(
        (new Date(original.deadline).getTime() - new Date(original.createdAt).getTime()) / 86400000
      ),
      recurrentDays: Math.ceil(
        (new Date(recurrent.deadline).getTime() - new Date(recurrent.createdAt).getTime()) / 86400000
      ),
    },
  })
})

router.get('/round/:issueId', (req: Request, res: Response): void => {
  const round = getIssueRecurrenceRound(req.params.issueId)
  res.json({ success: true, data: { recurrenceRound: round } })
})

export default router
