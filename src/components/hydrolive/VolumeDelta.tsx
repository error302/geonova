'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import type { VolumeDelta as VolumeDeltaType } from '@/types/bathymetry'

interface VolumeDeltaProps {
  volumeDelta: VolumeDeltaType
}

export default function VolumeDelta({ volumeDelta }: VolumeDeltaProps) {
  const isPositive = volumeDelta.volume_change >= 0
  const TrendIcon = isPositive ? TrendingUp : TrendingDown
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Volume Change</p>
          <div className="flex items-center gap-2">
            <TrendIcon className={`h-5 w-5 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(volumeDelta.volume_change).toLocaleString()} m³
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Area Change</p>
          <p className="text-xl font-semibold">
            {volumeDelta.area_change >= 0 ? '+' : ''}{volumeDelta.area_change.toLocaleString()} m²
          </p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500">
          {volumeDelta.period.from} → {volumeDelta.period.to}
        </p>
      </div>
    </div>
  )
}
