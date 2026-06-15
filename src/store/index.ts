import { create } from 'zustand'
import type {
  Issue,
  IssueDetail,
  RemediationPlan,
  Reinspection,
  Photo,
  ApprovalRecord,
  ExtensionRequest,
  AuditLog,
  RiskScore,
  RiskDeduction,
  User,
} from '@/types'

interface AppState {
  currentUser: User
  users: User[]
  issues: Issue[]
  issueDetail: IssueDetail | null
  plans: RemediationPlan[]
  reinspections: Reinspection[]
  photos: Photo[]
  approvals: ApprovalRecord[]
  extensions: ExtensionRequest[]
  auditLogs: AuditLog[]
  riskScores: RiskScore[]
  riskDeductions: RiskDeduction[]
  rules: any[]
  loading: boolean
  error: string | null

  setCurrentUser: (user: User) => void
  fetchIssues: (params?: Record<string, string>) => Promise<void>
  fetchIssueDetail: (id: string) => Promise<void>
  createIssue: (data: Partial<Issue>) => Promise<void>
  assignIssue: (id: string, assignedTo: string) => Promise<void>
  reopenIssue: (id: string, originalIssueId: string, reopenedBy: string) => Promise<void>
  submitPlan: (data: Partial<RemediationPlan>) => Promise<void>
  fetchPlans: (issueId?: string) => Promise<void>
  createReinspection: (data: Partial<Reinspection>) => Promise<void>
  updateReinspection: (id: string, data: Partial<Reinspection>) => Promise<void>
  fetchReinspections: (issueId?: string) => Promise<void>
  addPhoto: (data: Partial<Photo>) => Promise<void>
  fetchPhotos: (issueId?: string, category?: string) => Promise<void>
  approvePlan: (planId: string, decision: string, comment: string, approver: string) => Promise<void>
  approveExtension: (extensionId: string, decision: string, comment: string, approver: string) => Promise<void>
  fetchApprovals: (params?: Record<string, string>) => Promise<void>
  submitExtension: (data: Partial<ExtensionRequest>) => Promise<void>
  fetchExtensions: (issueId?: string) => Promise<void>
  fetchAuditLogs: (issueId?: string) => Promise<void>
  fetchRisk: () => Promise<void>
  closeIssue: (issueId: string, closedBy: string) => Promise<void>
  fetchRules: () => Promise<void>
  processOverdue: () => Promise<any>
  checkCanClose: (issueId: string) => Promise<any>
  checkCanReinspect: (issueId: string) => Promise<any>
  getOverdueStatus: (issueId: string) => Promise<any>
  clearError: () => void
}

const API = (path: string, options?: RequestInit) => fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })

const DEMO_USER: User = { id: 'auditor1', name: '张审计', role: 'auditor' }

export const useStore = create<AppState>((set, get) => ({
  currentUser: DEMO_USER,
  users: [
    { id: 'auditor1', name: '张审计', role: 'auditor' },
    { id: 'responsible1', name: '李负责', role: 'responsible' },
    { id: 'safety1', name: '王安全', role: 'safety' },
    { id: 'supervisor1', name: '赵主管', role: 'supervisor' },
  ],
  issues: [],
  issueDetail: null,
  plans: [],
  reinspections: [],
  photos: [],
  approvals: [],
  extensions: [],
  auditLogs: [],
  riskScores: [],
  riskDeductions: [],
  rules: [],
  loading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  fetchIssues: async (params) => {
    set({ loading: true })
    try {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      const res = await API(`/issues${qs}`)
      const json = await res.json()
      if (json.success) set({ issues: json.data, loading: false })
      else set({ error: json.error, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchIssueDetail: async (id) => {
    set({ loading: true })
    try {
      const res = await API(`/issues/${id}`)
      const json = await res.json()
      if (json.success) set({ issueDetail: json.data, loading: false })
      else set({ error: json.error, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createIssue: async (data) => {
    set({ loading: true })
    try {
      const res = await API('/issues', { method: 'POST', body: JSON.stringify(data) })
      const json = await res.json()
      if (json.success) { await get().fetchIssues() }
      else set({ error: json.error, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  assignIssue: async (id, assignedTo) => {
    try {
      const res = await API(`/issues/${id}/assign`, { method: 'PUT', body: JSON.stringify({ assignedTo }) })
      const json = await res.json()
      if (json.success) { await get().fetchIssues() }
      else set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  reopenIssue: async (id, originalIssueId, reopenedBy) => {
    try {
      const res = await API(`/issues/${id}/reopen`, { method: 'POST', body: JSON.stringify({ originalIssueId, reopenedBy }) })
      const json = await res.json()
      if (json.success) { await get().fetchIssues(); await get().fetchRisk() }
      else set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  submitPlan: async (data) => {
    set({ loading: true })
    try {
      const res = await API('/plans', { method: 'POST', body: JSON.stringify(data) })
      const json = await res.json()
      if (json.success) { await get().fetchIssues(); await get().fetchPlans(data.issueId) }
      else set({ error: json.error, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchPlans: async (issueId) => {
    try {
      const qs = issueId ? `?issueId=${issueId}` : ''
      const res = await API(`/plans${qs}`)
      const json = await res.json()
      if (json.success) set({ plans: json.data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  createReinspection: async (data) => {
    set({ loading: true })
    try {
      const res = await API('/reinspections', { method: 'POST', body: JSON.stringify(data) })
      const json = await res.json()
      if (json.success) { await get().fetchIssues(); await get().fetchReinspections(data.issueId) }
      else set({ error: json.error, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  updateReinspection: async (id, data) => {
    try {
      const res = await API(`/reinspections/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      const json = await res.json()
      if (json.success) { await get().fetchIssues() }
      else set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchReinspections: async (issueId) => {
    try {
      const qs = issueId ? `?issueId=${issueId}` : ''
      const res = await API(`/reinspections${qs}`)
      const json = await res.json()
      if (json.success) set({ reinspections: json.data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  addPhoto: async (data) => {
    try {
      const res = await API('/photos', { method: 'POST', body: JSON.stringify(data) })
      const json = await res.json()
      if (!json.success) set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchPhotos: async (issueId, category) => {
    try {
      const params = new URLSearchParams()
      if (issueId) params.set('issueId', issueId)
      if (category) params.set('category', category)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await API(`/photos${qs}`)
      const json = await res.json()
      if (json.success) set({ photos: json.data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  approvePlan: async (planId, decision, comment, approver) => {
    try {
      const res = await API(`/approvals/plan/${planId}`, { method: 'POST', body: JSON.stringify({ decision, comment, approver }) })
      const json = await res.json()
      if (res.status === 403) {
        set({ error: json.error || '越权操作：当前用户无主管审批权限（R009）' })
        return
      }
      if (json.success) { await get().fetchIssues(); await get().fetchPlans(); await get().fetchApprovals() }
      else set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  approveExtension: async (extensionId, decision, comment, approver) => {
    try {
      const res = await API(`/approvals/extension/${extensionId}`, { method: 'POST', body: JSON.stringify({ decision, comment, approver }) })
      const json = await res.json()
      if (res.status === 403) {
        set({ error: json.error || '越权操作：当前用户无主管审批权限（R009）' })
        return
      }
      if (json.success) { await get().fetchIssues(); await get().fetchExtensions(); await get().fetchApprovals() }
      else set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchApprovals: async (params) => {
    try {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      const res = await API(`/approvals${qs}`)
      const json = await res.json()
      if (json.success) set({ approvals: json.data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  submitExtension: async (data) => {
    try {
      const res = await API('/extensions', { method: 'POST', body: JSON.stringify(data) })
      const json = await res.json()
      if (json.success) { await get().fetchExtensions(data.issueId) }
      else set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchExtensions: async (issueId) => {
    try {
      const qs = issueId ? `?issueId=${issueId}` : ''
      const res = await API(`/extensions${qs}`)
      const json = await res.json()
      if (json.success) set({ extensions: json.data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchAuditLogs: async (issueId) => {
    try {
      const qs = issueId ? `?issueId=${issueId}` : ''
      const res = await API(`/audit${qs}`)
      const json = await res.json()
      if (json.success) set({ auditLogs: json.data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchRisk: async () => {
    try {
      const res = await API('/risk')
      const json = await res.json()
      if (json.success) {
        set({ riskScores: json.data.scores, riskDeductions: json.data.deductions })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  closeIssue: async (issueId, closedBy) => {
    try {
      const res = await API(`/risk/close-issue/${issueId}`, { method: 'POST', body: JSON.stringify({ closedBy }) })
      const json = await res.json()
      if (json.success) { await get().fetchIssues() }
      else set({ error: json.error })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearError: () => set({ error: null }),

  fetchRules: async () => {
    try {
      const res = await API('/rules')
      const json = await res.json()
      if (json.success) set({ rules: json.data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  processOverdue: async () => {
    try {
      const res = await API('/rules/process-overdue', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        await get().fetchIssues()
        await get().fetchRisk()
        return json.data
      }
      set({ error: json.error })
      return null
    } catch (e: any) {
      set({ error: e.message })
      return null
    }
  },

  checkCanClose: async (issueId) => {
    try {
      const res = await API(`/rules/can-close/${issueId}`)
      const json = await res.json()
      if (json.success) return json.data
      set({ error: json.error })
      return null
    } catch (e: any) {
      set({ error: e.message })
      return null
    }
  },

  checkCanReinspect: async (issueId) => {
    try {
      const res = await API(`/rules/can-reinspect/${issueId}`)
      const json = await res.json()
      if (json.success) return json.data
      set({ error: json.error })
      return null
    } catch (e: any) {
      set({ error: e.message })
      return null
    }
  },

  getOverdueStatus: async (issueId) => {
    try {
      const res = await API(`/rules/overdue-status/${issueId}`)
      const json = await res.json()
      if (json.success) return json.data
      set({ error: json.error })
      return null
    } catch (e: any) {
      set({ error: e.message })
      return null
    }
  },
}))
