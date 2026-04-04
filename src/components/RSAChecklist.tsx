'use client'

import { useState } from 'react'

interface RSACheckItem {
  id: string
  text: string
  checked: boolean
}

interface RSAStage {
  id: number
  name: string
  description: string
  items: RSACheckItem[]
}

const STAGE_TEMPLATES: Record<number, { name: string; description: string; items: string[] }> = {
  1: {
    name: 'Preliminary Design',
    description: 'Stage 1 — Preliminary Design',
    items: [
      'Road safety policy and speed limits identified',
      'Road hierarchy and function established',
      'Design domain parameters defined (terrain, land use)',
      'Crash history reviewed at desktop stage',
      'Sight distance constraints identified',
      'Pedestrian and cyclist needs assessed at concept level',
      'Emergency access and evacuation routes considered',
      'Road safety audit team briefed',
    ],
  },
  2: {
    name: 'Draft Design',
    description: 'Stage 2 — Draft Design',
    items: [
      'Horizontal and vertical alignment reviewed for safety',
      'Cross-section elements checked (lane widths, shoulders, medians)',
      'Intersection type and layout reviewed',
      'Pedestrian and cyclist facilities assessed',
      'Clear zone and hazard-free area reviewed',
      'Drainage design reviewed for road safety',
      'Road signs and markings concept approved',
      'Lighting requirements assessed at critical locations',
      'Construction stage traffic management plan reviewed',
    ],
  },
  3: {
    name: 'Detailed Design',
    description: 'Stage 3 — Detailed Design',
    items: [
      'All roadside hazards assessed and addressed',
      'Road restraint systems (barriers) specified where needed',
      'Kerb type and placement reviewed for vehicle occupants',
      'Sign and signal visibility confirmed',
      'Road lighting detailed at intersections and pedestrian crossings',
      'Edge lines, lane markings, and delineation reviewed',
      'Motorcycle facilities included where applicable',
      'Public transport stops and access reviewed',
      'Traffic calming measures reviewed',
      'Emergency vehicle access confirmed',
    ],
  },
  4: {
    name: 'Road Works',
    description: 'Stage 4 — Road Works (during construction)',
    items: [
      'Traffic management plan implemented correctly',
      'Work zone signage and delineation adequate',
      'Temporary speed limits appropriate',
      'Pedestrian and cyclist diversions safe',
      'Construction plant movements managed',
      'Road surface quality maintained during works',
      'Workers protected from traffic',
      'Emergency access maintained at all times',
      'Night-time safety arrangements adequate',
    ],
  },
  5: {
    name: 'Pre-Opening',
    description: 'Stage 5 — Pre-Opening',
    items: [
      'All safety features inspected and operational',
      'Road restraint systems inspected and certified',
      'Signage and road markings complete and correct',
      'Lighting operational and compliant',
      'Speed limits legally posted',
      'Pedestrian and cyclist facilities complete',
      'Emergency services notified of opening',
      'As-built drawings verified against design',
      'Final road safety audit report compiled',
    ],
  },
  6: {
    name: 'Existing Facility',
    description: 'Stage 6 — Existing Facility (post-opening review)',
    items: [
      'Crash pattern analysis conducted (minimum 12 months data)',
      'Operating speed profile assessed against design speed',
      'Pedestrian and cyclist safety reviewed',
      'Road surface condition reviewed ( skid resistance)',
      'Signage effectiveness assessed',
      'Lighting performance reviewed',
      'Emergency response routes confirmed',
      'Maintenance programme addresses safety-critical items',
      'Crash reduction targets set and monitored',
      'Recommendations for improvements documented',
    ],
  },
}

export default function RSAChecklist() {
  const [activeStage, setActiveStage] = useState(1)
  const [completed, setCompleted] = useState<Record<number, Set<string>>>({})

  const stages = Object.entries(STAGE_TEMPLATES).map(([id, t]) => ({
    id: parseInt(id),
    name: t.name,
    description: t.description,
    items: t.items.map((item: any) => ({
      id: `${id}-${item}`,
      text: item,
      checked: completed[parseInt(id)]?.has(`${id}-${item}`) ?? false,
    })),
  }))

  const toggleItem = (stageId: number, itemId: string) => {
    setCompleted(prev => {
      const stageSet = new Set(prev[stageId] || [])
      if (stageSet.has(itemId)) {
        stageSet.delete(itemId)
      } else {
        stageSet.add(itemId)
      }
      return { ...prev, [stageId]: stageSet }
    })
  }

  const currentStage = stages.find((s: any) => s.id === activeStage)
  const checkedCount = currentStage?.items.filter((i: any) => i.checked).length ?? 0
  const totalCount = currentStage?.items.length ?? 0
  const allChecked = checkedCount === totalCount && totalCount > 0

  const completedStages = stages.filter((s: any) => {
    const stageSet = completed[s.id]
    return stageSet && stageSet.size === STAGE_TEMPLATES[s.id].items.length
  }).length

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">Road Safety Audit Checklist — RDM Part 1b</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{completedStages} of {stages.length} stages complete</p>
      </div>

      <div className="flex overflow-x-auto border-b border-[var(--border-color)]">
        {stages.map((stage: any) => {
          const stageSet = completed[stage.id]
          const isDone = stageSet && stageSet.size === STAGE_TEMPLATES[stage.id].items.length
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-r border-[var(--border-color)] transition-colors ${
                activeStage === stage.id
                  ? 'bg-amber-500/20 text-amber-400 border-b-2 border-b-amber-500'
                  : isDone
                  ? 'bg-green-900/20 text-green-400 hover:bg-green-900/30'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="font-bold">Stage {stage.id}</div>
              <div className="max-w-[80px] truncate">{stage.name}</div>
            </button>
          )
        })}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{currentStage?.description}</h3>
          <span className="text-xs text-[var(--text-secondary)]">{checkedCount}/{totalCount} items</span>
        </div>

        {currentStage?.items.map((item: any) => (
          <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggleItem(activeStage, item.id)}
              className="mt-0.5 w-4 h-4 rounded border-[var(--border-color)] accent-amber-500"
            />
            <span className={`text-sm flex-1 ${item.checked ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
              {item.text}
            </span>
          </label>
        ))}

        {allChecked && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded text-xs text-green-400">
            Stage {activeStage} complete. Move to next stage when ready.
          </div>
        )}
      </div>
    </div>
  )
}
