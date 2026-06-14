import { Router, type Request, type Response } from 'express'
import { getCollection, addToCollection, filterCollection, generateId } from '../lib/db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId, category } = req.query
  let photos = getCollection<any>('photos')
  if (issueId) photos = photos.filter((p) => p.issueId === issueId)
  if (category) photos = photos.filter((p) => p.category === category)
  res.json({ success: true, data: photos })
})

router.post('/', (req: Request, res: Response): void => {
  const { issueId, category, url, uploadedBy } = req.body
  if (!issueId || !category || !uploadedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const photo = {
    id: generateId(),
    issueId,
    category,
    url: url || `/uploads/${issueId}-${category}-${Date.now()}.jpg`,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  }
  addToCollection('photos', photo)
  res.status(201).json({ success: true, data: photo })
})

export default router
