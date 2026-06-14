import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { useStore } from '@/store'
import type { IssueSeverity } from '@/types'
import { SEVERITY_LABELS } from '@/types'

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  high: 'border-l-4 border-l-rose-500',
  medium: 'border-l-4 border-l-amber-500',
  low: 'border-l-4 border-l-blue-500',
}

export default function IssueNew() {
  const navigate = useNavigate()
  const { currentUser, createIssue, addPhoto } = useStore()

  const [regulationClause, setRegulationClause] = useState('')
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<IssueSeverity>('high')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [clientConfirmationRequired, setClientConfirmationRequired] = useState(false)
  const [photoCount, setPhotoCount] = useState(0)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return
    await createIssue({
      title: title.trim(),
      regulationClause: regulationClause.trim(),
      severity,
      description: description.trim(),
      deadline,
      clientConfirmationRequired,
      createdBy: currentUser.id,
    })
    navigate('/issues')
  }

  const handleAddPhoto = () => {
    addPhoto({
      issueId: 'new',
      category: 'evidence',
      url: `https://picsum.photos/200?random=${Date.now()}`,
      uploadedBy: currentUser.id,
    })
    setPhotoCount((c) => c + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/issues')} className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">提交审厂问题</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">法规条款</label>
            <input
              type="text"
              value={regulationClause}
              onChange={(e) => setRegulationClause(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              问题标题 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">问题级别</label>
            <div className="flex gap-3">
              {(['high', 'medium', 'low'] as IssueSeverity[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSeverity(level)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all
                    ${SEVERITY_STYLES[level]}
                    ${severity === level ? 'bg-gray-100 ring-2 ring-blue-500' : 'bg-gray-50'}`}
                >
                  {SEVERITY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              问题描述 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">客户确认要求</label>
            <button
              type="button"
              onClick={() => setClientConfirmationRequired((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${clientConfirmationRequired ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${clientConfirmationRequired ? 'translate-x-5' : ''}`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">照片证据</label>
            <button
              type="button"
              onClick={handleAddPhoto}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm">点击上传照片证据</span>
            </button>
            {photoCount > 0 && (
              <div className="mt-2 flex gap-2">
                {Array.from({ length: photoCount }).map((_, i) => (
                  <div key={i} className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                    照片{i + 1}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !description.trim()}
          className="w-full bg-blue-500 text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed active:bg-blue-600 transition-colors"
        >
          提交问题
        </button>
      </div>
    </div>
  )
}
