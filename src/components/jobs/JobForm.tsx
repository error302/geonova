'use client';

import { useState } from 'react'
import { createJob, getEquipmentByType, getChecklistByType, CreateJobInput } from '@/lib/api-client/jobs'

interface JobFormProps {
  surveyType?: string
  onSuccess?: () => void
}

export default function JobForm({ surveyType, onSuccess }: JobFormProps): JSX.Element {
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    survey_type: surveyType || 'boundary',
    scheduled_date: '',
    crew_size: 1,
    notes: ''
  })
  const [equipment, setEquipment] = useState<string[]>([])
  const [checklist, setChecklist] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const loadRecommendations = async (type: string) => {
    const equip = await getEquipmentByType(type)
    const checks = await getChecklistByType(type)
    setEquipment(equip)
    setChecklist(checks)
  }

  const handleTypeChange = async (type: string) => {
    setFormData({ ...formData, survey_type: type })
    await loadRecommendations(type)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const jobData = { ...formData, status: 'planned' } as CreateJobInput
      await createJob(jobData)
      onSuccess?.()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="mission-name">Mission Name *</label>
        <input id="mission-name" aria-label="Name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="client">Client</label>
        <input id="client" aria-label="Client"
          type="text"
          value={formData.client}
          onChange={(e) => setFormData({...formData, client: e.target.value})}
          className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="survey-type">Survey Type *</label>
        <select id="survey-type"
          value={formData.survey_type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
          required
        >
          <option value="boundary">Boundary Survey</option>
          <option value="topographic">Topographic Survey</option>
          <option value="leveling">Leveling Survey</option>
          <option value="road">Road Survey</option>
          <option value="construction">Construction Survey</option>
          <option value="control">Control Network</option>
          <option value="drone">Drone/UAV Survey</option>
          <option value="gnss">GNSS Survey</option>
          <option value="other">Other</option>
        </select>
      </div>

      {equipment.length > 0 && (
        <div>
          <div className="block text-sm font-medium text-gray-300 mb-2">Recommended Equipment</div>
          <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg border border-[var(--border-color)]">
            <div className="flex flex-wrap gap-2">
              {equipment.map((item, idx) => (
                <span key={`${item}-${idx}`} className="text-xs bg-[#D17B47]/20 text-[#D17B47] px-2 py-1 rounded">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <div className="block text-sm font-medium text-gray-300 mb-2">Preparation Checklist</div>
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-2">
            {checklist.map((task, idx) => (
              <label key={`${task}-${idx}`} className="flex items-center gap-2 text-sm text-gray-300">
                <input aria-label="Preparation Checklist" type="checkbox" className="rounded" />
                {task}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="crew-size">Crew Size</label>
          <input id="crew-size" aria-label="Crew size"
            type="number"
            value={formData.crew_size}
            onChange={(e) => setFormData({...formData, crew_size: parseInt(e.target.value)})}
            min="1"
            max="20"
            className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="scheduled-date">Scheduled Date</label>
          <input id="scheduled-date" aria-label="Scheduled date"
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
            className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="notes">Notes</label>
        <textarea
           id="notes" value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          rows={3}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-[#D17B47] focus:outline-none text-gray-100 resize-vertical"
          placeholder="Special instructions, weather concerns, etc."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#D17B47] hover:bg-[#d67715] text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating Mission...' : 'Create Field Mission'}
      </button>
    </form>
  )
}

