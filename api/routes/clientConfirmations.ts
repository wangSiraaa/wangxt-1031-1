import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  createAuditLog,
  canModifyEvidence,
  checkClosureEvidenceLocked,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId, isClosureEvidence } = req.query
  let confirmations = getCollection<any>('clientConfirmations')
  if (issueId) confirmations = confirmations.filter((c) => c.issueId === issueId)
  if (isClosureEvidence !== undefined)
    confirmations = confirmations.filter((c) => c.isClosureEvidence === (isClosureEvidence === 'true'))
  confirmations.sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime())
  res.json({ success: true, data: confirmations })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, confirmedBy, confirmationContent, contactInfo, isClosureEvidence } = req.body
  if (!issueId || !confirmedBy || !confirmationContent) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const confirmation = {
    id: generateId(),
    issueId,
    confirmedBy,
    confirmedAt: new Date().toISOString(),
    confirmationContent,
    isClosureEvidence: !!isClosureEvidence,
    contactInfo: contactInfo || null,
  }
  addToCollection('clientConfirmations', confirmation)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === req.body.submittedBy)
  if (isClosureEvidence && !issue.closureEvidenceLocked) {
    updateInCollection('issues', issueId, {
      closureEvidenceLocked: true,
    })
    createAuditLog(
      issueId,
      'evidence_locked',
      user?.name || req.body.submittedBy || confirmedBy,
      user?.role || 'auditor',
      '客户确认已锁定为关闭依据（R012）'
    )
  } else {
    createAuditLog(
      issueId,
      'client_confirmation_submitted',
      user?.name || req.body.submittedBy || confirmedBy,
      user?.role || 'auditor',
      `客户确认已提交：${confirmedBy}`
    )
  }
  res.status(201).json({ success: true, data: confirmation })
})

router.put('/:id', (req: Request, res: Response): void => {
  const confirmation = findInCollection<any>('clientConfirmations', req.params.id)
  if (!confirmation) {
    res.status(404).json({ success: false, error: '客户确认不存在' })
    return
  }
  const modifyCheck = canModifyEvidence(confirmation.issueId, confirmation.id)
  if (!modifyCheck.allowed) {
    res.status(403).json({ success: false, error: modifyCheck.reason })
    return
  }
  const updates = { ...req.body }
  delete updates.id
  delete updates.issueId
  delete updates.confirmedBy
  delete updates.confirmedAt
  const updated = updateInCollection('clientConfirmations', req.params.id, updates)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === req.body.updatedBy)
  createAuditLog(
    confirmation.issueId,
    'client_confirmation_updated',
    user?.name || req.body.updatedBy || '系统',
    user?.role || 'system',
    '更新客户确认信息'
  )
  res.json({ success: true, data: updated })
})

router.put('/:id/lock-as-evidence', (req: Request, res: Response): void => {
  const confirmation = findInCollection<any>('clientConfirmations', req.params.id)
  if (!confirmation) {
    res.status(404).json({ success: false, error: '客户确认不存在' })
    return
  }
  const { lockedBy } = req.body
  const updated = updateInCollection('clientConfirmations', req.params.id, {
    isClosureEvidence: true,
  })
  const issue = findInCollection<any>('issues', confirmation.issueId)
  if (issue && !issue.closureEvidenceLocked) {
    updateInCollection('issues', confirmation.issueId, {
      closureEvidenceLocked: true,
    })
  }
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === lockedBy)
  createAuditLog(
    confirmation.issueId,
    'evidence_locked',
    user?.name || lockedBy,
    user?.role || 'auditor',
    '客户确认已锁定为关闭依据（R012）'
  )
  res.json({ success: true, data: updated })
})

export default router
