import { Router, type Request, type Response } from 'express'
import { getCollection, filterCollection } from '../lib/db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { issueId } = req.query
  let logs = getCollection<any>('auditLogs')
  if (issueId) logs = logs.filter((l) => l.issueId === issueId)
  logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  res.json({ success: true, data: logs })
})

export default router
