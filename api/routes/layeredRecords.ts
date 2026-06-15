import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  incrementVersion,
  createAuditLog,
  validateSupervisorRole,
  checkLayeredRecordsComplete,
  createLayeredRecord as createLayeredRecordRule,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId, type, status } = req.query
  let records = getCollection<any>('layeredRecords')
  if (issueId) records = records.filter((r) => r.issueId === issueId)
  if (type) records = records.filter((r) => r.type === type)
  if (status) records = records.filter((r) => r.status === status)
  records.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
  res.json({ success: true, data: records })
})

router.get('/:id', (req: Request, res: Response): void => {
  const record = findInCollection<any>('layeredRecords', req.params.id)
  if (!record) {
    res.status(404).json({ success: false, error: '分层记录不存在' })
    return
  }
  res.json({ success: true, data: record })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, type, content, submittedBy } = req.body
  if (!issueId || !type || !content || !submittedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const validTypes = ['rectification_plan', 'capa_measures', 'extension_request', 'supervisor_approval']
  if (!validTypes.includes(type)) {
    res.status(400).json({ success: false, error: '无效的分层记录类型' })
    return
  }
  const record = createLayeredRecordRule(issueId, type, content, submittedBy)
  res.status(201).json({ success: true, data: record })
})

router.put('/:id/approve', (req: Request, res: Response): void => {
  const record = findInCollection<any>('layeredRecords', req.params.id)
  if (!record) {
    res.status(404).json({ success: false, error: '分层记录不存在' })
    return
  }
  const { approver, comment } = req.body
  const roleCheck = validateSupervisorRole(approver)
  if (!roleCheck.allowed) {
    res.status(403).json({ success: false, error: roleCheck.reason })
    return
  }
  const updated = updateInCollection('layeredRecords', req.params.id, {
    status: 'approved',
    approvedBy: approver,
    approvedAt: new Date().toISOString(),
    comment: comment || null,
    version: incrementVersion(record),
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === approver)
  createAuditLog(
    record.issueId,
    'layered_record_approved',
    user?.name || approver,
    user?.role || 'supervisor',
    `审批通过分层记录（${record.type}）`
  )
  const completeness = checkLayeredRecordsComplete(record.issueId)
  if (completeness.complete) {
    createAuditLog(
      record.issueId,
      'layered_records_complete',
      user?.name || approver,
      user?.role || 'supervisor',
      '所有必需分层记录已审批完成（R010）'
    )
  }
  res.json({ success: true, data: updated, completeness })
})

router.put('/:id/reject', (req: Request, res: Response): void => {
  const record = findInCollection<any>('layeredRecords', req.params.id)
  if (!record) {
    res.status(404).json({ success: false, error: '分层记录不存在' })
    return
  }
  const { approver, comment } = req.body
  const roleCheck = validateSupervisorRole(approver)
  if (!roleCheck.allowed) {
    res.status(403).json({ success: false, error: roleCheck.reason })
    return
  }
  if (!comment) {
    res.status(400).json({ success: false, error: '驳回必须填写理由' })
    return
  }
  const updated = updateInCollection('layeredRecords', req.params.id, {
    status: 'rejected',
    approvedBy: approver,
    approvedAt: new Date().toISOString(),
    comment,
    version: incrementVersion(record),
  })
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === approver)
  createAuditLog(
    record.issueId,
    'layered_record_rejected',
    user?.name || approver,
    user?.role || 'supervisor',
    `驳回分层记录（${record.type}）：${comment}`
  )
  res.json({ success: true, data: updated })
})

router.get('/completeness/:issueId', (req: Request, res: Response): void => {
  const completeness = checkLayeredRecordsComplete(req.params.issueId)
  res.json({ success: true, data: completeness })
})

export default router
