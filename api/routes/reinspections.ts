import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  incrementVersion,
  createAuditLog,
  canStartReinspection,
  checkReinspectionPhotosComplete,
  canTransitionStatus,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId } = req.query
  let records = getCollection<any>('reinspections')
  if (issueId) records = records.filter((r) => r.issueId === issueId)
  res.json({ success: true, data: records })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, planDate, actualDate, result, notes, inspector } = req.body
  if (!issueId || !inspector) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const canStart = canStartReinspection(issue)
  if (!canStart.allowed) {
    res.status(400).json({ success: false, error: canStart.reason })
    return
  }
  if (!canTransitionStatus(issue.status, 'reinspection_in_progress')) {
    res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许开始复查` })
    return
  }
  const record = {
    id: generateId(),
    issueId,
    planDate: planDate || new Date().toISOString(),
    actualDate: actualDate || new Date().toISOString(),
    result: result || 'pending',
    notes: notes || '',
    inspector,
    createdAt: new Date().toISOString(),
  }
  addToCollection('reinspections', record)
  updateInCollection('issues', issueId, {
    status: 'reinspection_in_progress',
    version: incrementVersion(issue),
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === inspector)
  createAuditLog(
    issueId,
    'reinspection_started',
    user?.name || inspector,
    'safety',
    `开始复检${notes ? '：' + notes : ''}`,
  )
  res.status(201).json({ success: true, data: record })
})

router.put('/:id', (req: Request, res: Response): void => {
  const record = findInCollection<any>('reinspections', req.params.id)
  if (!record) {
    res.status(404).json({ success: false, error: '复查记录不存在' })
    return
  }
  const { result, notes } = req.body
  const updated = updateInCollection('reinspections', req.params.id, {
    result: result || record.result,
    notes: notes || record.notes,
    actualDate: new Date().toISOString(),
  })
  const issue = findInCollection<any>('issues', record.issueId)
  if (issue && result === 'pass') {
    const hasPhotos = checkReinspectionPhotosComplete(record.issueId)
    if (hasPhotos) {
      if (!canTransitionStatus(issue.status, 'reinspection_passed')) {
        res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许转换到复查通过` })
        return
      }
      updateInCollection('issues', record.issueId, {
        status: 'reinspection_passed',
        version: incrementVersion(issue),
      })
      createAuditLog(
        record.issueId,
        'reinspection_passed',
        record.inspector,
        'safety',
        `复检通过${notes ? '：' + notes : ''}`,
      )
    } else {
      res.json({
        success: true,
        data: {
          ...updated,
          warning: '复查结果已保存，但因缺失复查照片，问题状态未更新',
        },
      })
      return
    }
  } else if (issue && result === 'fail') {
    if (!canTransitionStatus(issue.status, 'assigned')) {
      res.status(400).json({ success: false, error: `当前状态 ${issue.status} 不允许转换到分派状态` })
      return
    }
    updateInCollection('issues', record.issueId, {
      status: 'assigned',
      version: incrementVersion(issue),
    })
    createAuditLog(
      record.issueId,
      'reinspection_failed',
      updated.inspector,
      'safety',
      `复检未通过，需重新整改${notes ? '：' + notes : ''}`,
    )
  }
  res.json({ success: true, data: updated })
})

export default router
