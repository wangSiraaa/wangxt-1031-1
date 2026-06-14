import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, filterCollection, generateId } from '../lib/db.js'
import { createAuditLog } from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId } = req.query
  let records = getCollection<any>('extensionRequests')
  if (issueId) records = records.filter((r) => r.issueId === issueId)
  res.json({ success: true, data: records })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, reason, requestedDeadline } = req.body
  if (!issueId || !reason || !requestedDeadline) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const record = {
    id: generateId(),
    issueId,
    reason,
    requestedDeadline,
    status: 'pending',
    approvedBy: null,
    createdAt: new Date().toISOString(),
  }
  addToCollection('extensionRequests', record)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === issue.assignedTo)
  createAuditLog(
    issueId,
    'extension_requested',
    user?.name || issue.assignedTo || 'unknown',
    'responsible',
    `申请延期至${new Date(requestedDeadline).toLocaleDateString('zh-CN')}，原因：${reason}`,
  )
  res.status(201).json({ success: true, data: record })
})

export default router
