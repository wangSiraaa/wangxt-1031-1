import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import issueRoutes from './routes/issues.js'
import planRoutes from './routes/plans.js'
import reinspectionRoutes from './routes/reinspections.js'
import approvalRoutes from './routes/approvals.js'
import extensionRoutes from './routes/extensions.js'
import photoRoutes from './routes/photos.js'
import auditRoutes from './routes/audit.js'
import riskRoutes from './routes/risk.js'
import rulesRoutes from './routes/rules.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/issues', issueRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/reinspections', reinspectionRoutes)
app.use('/api/approvals', approvalRoutes)
app.use('/api/extensions', extensionRoutes)
app.use('/api/photos', photoRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/risk', riskRoutes)
app.use('/api/rules', rulesRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
