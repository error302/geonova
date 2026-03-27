'use client'

import { AlertTriangle } from 'lucide-react'
import type { Hazard } from '@/types/bathymetry'

interface HazardAlertProps {
  hazard: Hazard
}

const severityColors = {
  low: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200',
  medium: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200',
  high: 'bg-red-50 dark:bg-red-900/20 border-red-200'
}

const severityTextColors = {
  low: 'text-yellow-700 dark:text-yellow-400',
  medium: 'text-orange-700 dark:text-orange-400',
  high: 'text-red-700 dark:text-red-400'
}

export default function HazardAlert({ hazard }: HazardAlertProps) {
  return (
    <div className={`rounded-lg p-4 border ${severityColors[hazard.severity]}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-5 w-5 mt-0.5 ${severityTextColors[hazard.severity]}`} />
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold capitalize ${severityTextColors[hazard.severity]}`}>
              {hazard.severity}
            </span>
            <span className="text-sm text-gray-500">- {hazard.type}</span>
          </div>
          
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            {hazard.description}
          </p>
          
          <div className="flex gap-4 text-xs text-gray-500">
            <span>Depth: {hazard.depth.toFixed(2)}m</span>
            <span>E: {hazard.location.easting.toFixed(2)}</span>
            <span>N: {hazard.location.northing.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
