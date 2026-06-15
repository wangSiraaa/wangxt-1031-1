import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  createAuditLog,
  canModifyEvidence,
  checkClosureEvidenceLocked,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId, type, isClosureEvidence } = req.query
  let data = getCollection<any>('monitoringData')
  if (issueId) data = data.filter((m) => m.issueId === issueId)
  if (type) data = data.filter((m) => m.type === type)
  if (isClosureEvidence !== undefined)
    data = data.filter((m) => m.isClosureEvidence === (isClosureEvidence === 'true'))
  data.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
  res.json({ success: true, data })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, type, value, unit, measuredAt, measuredBy, isClosureEvidence, notes } = req.body
  if (!issueId || !type || !value || !measuredBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const monitoring = {
    id: generateId(),
    issueId,
    type,
    value,
    unit: unit || null,
    measuredAt: measuredAt || new Date().toISOString(),
    measuredBy,
    isClosureEvidence: !!isClosureEvidence,
    notes: notes || null,
  }
  addToCollection('monitoringData', monitoring)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === measuredBy)
  createAuditLog(
    issueId,
    'monitoring_submitted',
    user?.name || measuredBy,
    user?.role || 'safety',
    `提交监测数据：${type}=${value}${unit || ''}`
  )
  res.status(201).json({ success: true, data: monitoring })
})

router.put('/:id', (req: Request, res: Response): void => {
  const monitoring = findInCollection<any>('monitoringData', req.params.id)
  if (!monitoring) {
    res.status(404).json({ success: false, error: '监测数据不存在' })
    return
  }
  const modifyCheck = canModifyEvidence(monitoring.issueId, monitoring.id)
  if (!modifyCheck.allowed) {
    res.status(403).json({ success: false, error: modifyCheck.reason })
    return
  }
  const updates = { ...req.body }
  delete updates.id
  delete updates.issueId
  delete updates.measuredBy
  const updated = updateInCollection('monitoringData', req.params.id, updates)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === req.body.updatedBy)
  createAuditLog(
    monitoring.issueId,
    'monitoring_updated',
    user?.name || req.body.updatedBy || '系统',
    user?.role || 'system',
    '更新监测数据'
  )
  res.json({ success: true, data: updated })
})

router.put('/:id/lock-as-evidence', (req: Request, res: Response): void => {
  const monitoring = findInCollection<any>('monitoringData', req.params.id)
  if (!monitoring) {
    res.status(404).json({ success: false, error: '监测数据不存在' })
    return
  }
  const { lockedBy } = req.body
  const updated = updateInCollection('monitoringData', req.params.id, {
    isClosureEvidence: true,
  })
  const issue = findInCollection<any>('issues', monitoring.issueId)
  if (issue && !issue.closureEvidenceLocked) {
    updateInCollection('issues', monitoring.issueId, {
      closureEvidenceLocked: true,
    })
  }
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === lockedBy)
  createAuditLog(
    monitoring.issueId,
    'evidence_locked',
    user?.name || lockedBy,
    user?.role || 'safety',
    '监测数据已锁定为关闭依据（R012）'
  )
  res.json({ success: true, data: updated })
})

router.get('/lock-status/:issueId', (req: Request, res: Response): void => {
  const status = checkClosureEvidenceLocked(req.params.issueId)
  res.json({ success: true, data: status })
})

export default router
