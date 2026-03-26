'use client'

import { Box } from 'lucide-react'
import type { VolumeCalculation } from '@/types/minetwin'

interface VolumePanelProps {
  volumes: VolumeCalculation
}

export default function VolumePanel({ volumes }: VolumePanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Box className="h-5 w-5" />
        Volume Calculations
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
          <p className="text-2xl font-bold">{volumes.total_volume.toLocaleString()} m³</p>
        </div>
        
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Ore Volume</p>
          <p className="text-2xl font-bold text-green-600">{volumes.ore_volume.toLocaleString()} m³</p>
        </div>
        
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Waste Volume</p>
          <p className="text-2xl font-bold text-red-600">{volumes.waste_volume.toLocaleString()} m³</p>
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Area</p>
          <p className="text-2xl font-bold">{volumes.area.toLocaleString()} m²</p>
        </div>
      </div>
    </div>
  )
}
