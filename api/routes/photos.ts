import { Router, type Request, type Response } from 'express'
import { getCollection, findInCollection, addToCollection, updateInCollection, filterCollection, generateId } from '../lib/db.js'
import {
  createAuditLog,
  canModifyEvidence,
  checkClosureEvidenceLocked,
} from '../services/businessRules.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId, category, isClosureEvidence } = req.query
  let photos = getCollection<any>('photos')
  if (issueId) photos = photos.filter((p) => p.issueId === issueId)
  if (category) photos = photos.filter((p) => p.category === category)
  if (isClosureEvidence !== undefined)
    photos = photos.filter((p) => p.isClosureEvidence === (isClosureEvidence === 'true'))
  res.json({ success: true, data: photos })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, category, url, uploadedBy, isClosureEvidence, isSupplemental, parentPhotoId } = req.body
  if (!issueId || !category || !uploadedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const issue = findInCollection<any>('issues', issueId)
  if (!issue) {
    res.status(404).json({ success: false, error: '问题不存在' })
    return
  }
  const existingPhotos = filterCollection<any>('photos', (p) => p.issueId === issueId && p.category === category)
  const evidenceVersion = isSupplemental
    ? existingPhotos.filter((p) => p.isClosureEvidence).length + 1
    : existingPhotos.length + 1
  const photo = {
    id: generateId(),
    issueId,
    category,
    url: url || `/uploads/${issueId}-${category}-${Date.now()}.jpg`,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    isClosureEvidence: !!isClosureEvidence,
    evidenceVersion,
    isSupplemental: !!isSupplemental,
    parentPhotoId: parentPhotoId || null,
  }
  addToCollection('photos', photo)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === uploadedBy)
  if (isClosureEvidence && !issue.closureEvidenceLocked) {
    updateInCollection('issues', issueId, {
      closureEvidenceLocked: true,
    })
    createAuditLog(
      issueId,
      'evidence_locked',
      user?.name || uploadedBy,
      user?.role || 'safety',
      '复查照片已锁定为关闭依据，后续仅可追加补证（R012）'
    )
  } else if (isSupplemental) {
    createAuditLog(
      issueId,
      'evidence_supplemented',
      user?.name || uploadedBy,
      user?.role || 'safety',
      `追加补证照片（版本v${evidenceVersion}），原证据保持不变（R012）`
    )
  }
  res.status(201).json({ success: true, data: photo })
})

router.post('/supplement', (req: Request, res: Response): void => {
  const { issueId, category, url, uploadedBy, parentPhotoId, notes } = req.body
  if (!issueId || !category || !uploadedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const lockCheck = checkClosureEvidenceLocked(issueId)
  if (!lockCheck.locked) {
    res.status(400).json({ success: false, error: '当前问题无锁定证据，无需补证，请直接上传新证据' })
    return
  }
  const existingPhotos = filterCollection<any>('photos', (p) => p.issueId === issueId && p.isClosureEvidence)
  const evidenceVersion = existingPhotos.length + 1
  const photo = {
    id: generateId(),
    issueId,
    category,
    url: url || `/uploads/${issueId}-${category}-supplement-${Date.now()}.jpg`,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    isClosureEvidence: true,
    evidenceVersion,
    isSupplemental: true,
    parentPhotoId: parentPhotoId || null,
  }
  addToCollection('photos', photo)
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === uploadedBy)
  createAuditLog(
    issueId,
    'evidence_supplemented',
    user?.name || uploadedBy,
    user?.role || 'safety',
    `追加补证照片${notes ? `：${notes}` : ''}（版本v${evidenceVersion}），原证据保持不变（R012）`
  )
  res.status(201).json({ success: true, data: photo, lockedEvidence: lockCheck.evidence })
})

router.put('/:id', (req: Request, res: Response): void => {
  const photo = findInCollection<any>('photos', req.params.id)
  if (!photo) {
    res.status(404).json({ success: false, error: '照片不存在' })
    return
  }
  const modifyCheck = canModifyEvidence(photo.issueId, photo.id)
  if (!modifyCheck.allowed) {
    res.status(403).json({ success: false, error: modifyCheck.reason })
    return
  }
  const updates = { ...req.body }
  delete updates.id
  delete updates.issueId
  delete updates.uploadedBy
  delete updates.uploadedAt
  delete updates.evidenceVersion
  const updated = updateInCollection('photos', req.params.id, updates)
  res.json({ success: true, data: updated })
})

router.put('/:id/lock-as-evidence', (req: Request, res: Response): void => {
  const photo = findInCollection<any>('photos', req.params.id)
  if (!photo) {
    res.status(404).json({ success: false, error: '照片不存在' })
    return
  }
  const { lockedBy } = req.body
  const updated = updateInCollection('photos', req.params.id, {
    isClosureEvidence: true,
  })
  const issue = findInCollection<any>('issues', photo.issueId)
  if (issue && !issue.closureEvidenceLocked) {
    updateInCollection('issues', photo.issueId, {
      closureEvidenceLocked: true,
    })
  }
  const users = getCollection<any>('users')
  const user = users.find((u: any) => u.id === lockedBy)
  createAuditLog(
    photo.issueId,
    'evidence_locked',
    user?.name || lockedBy,
    user?.role || 'safety',
    '复查照片已锁定为关闭依据（R012）'
  )
  res.json({ success: true, data: updated })
})

router.get('/lock-status/:issueId', (req: Request, res: Response): void => {
  const status = checkClosureEvidenceLocked(req.params.issueId)
  res.json({ success: true, data: status })
})

export default router
