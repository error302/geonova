'use client'

import { useState } from 'react'
import { createJob, getEquipmentByType, getChecklistByType } from '@/lib/supabase/jobs'

interface JobFormProps {
  surveyType?: string
  onSuccess?: () => void
}

export default function JobForm({ surveyType, onSuccess }: JobFormProps) {
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


    e.preventDefault()
    setLoading(true)
    try {
      await createJob(formData)
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
        <label className="block text-sm font-medium text-gray-300 mb-2">Mission Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-[#E8841A] focus:outline-none text-gray-100"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Client</label>
        <input
          type="text"
          value={formData.client}
          onChange={(e) => setFormData({...formData, client: e.target.value})}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-[#E8841A] focus:outline-none text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Survey Type *</label>
        <select
          value={formData.survey_type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-[#E8841A] focus:outline-none text-gray-100"
          required
        >
          <option value="boundary">Boundary Survey</option>
          <option value="topographic">Topographic Survey</option>
          <option value="leveling">Leveling Survey</option>
          <option value="road">Road Survey</option>
          <option value="construction">Construction Survey</option>
          <option value="control">Control Network</option>
          <option value="mining">Mining Survey</option>
          <option value="hydrographic">Hydrographic Survey</option>
          <option value="drone">Drone/UAV Survey</option>
          <option value="gnss">GNSS Survey</option>
          <option value="other">Other</option>
        </select>
      </div>

      {equipment.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Recommended Equipment</label>
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
            <div className="flex flex-wrap gap-2">
              {equipment.map((item, idx) => (
                <span key={idx} className="text-xs bg-[#E8841A]/20 text-[#E8841A] px-2 py-1 rounded">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Preparation Checklist</label>
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-2">
            {checklist.map((task, idx) => (
              <label key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" className="rounded" />
                {task}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Crew Size</label>
          <input
            type="number"
            value={formData.crew_size}
            onChange={(e) => setFormData({...formData, crew_size: parseInt(e.target.value)})}
            min="1"
            max="20"
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-[#E8841A] focus:outline-none text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Scheduled Date</label>
          <input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-[#E8841A] focus:outline-none text-gray-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          rows={3}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-[#E8841A] focus:outline-none text-gray-100 resize-vertical"
          placeholder="Special instructions, weather concerns, etc."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating Mission...' : 'Create Field Mission'}
      </button>
    </form>
  )
}

