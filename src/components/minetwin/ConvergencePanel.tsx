'use client'

import { Activity } from 'lucide-react'
import type { ConvergencePoint } from '@/types/minetwin'

interface ConvergencePanelProps {
  convergence: ConvergencePoint[]
}

export default function ConvergencePanel({ convergence }: ConvergencePanelProps) {
  const maxShift = convergence.length > 0 ? Math.max(...convergence.map((c: any) => c.total_shift), 0) : 0
  const avgShift = convergence.length > 0 ? convergence.reduce((sum, c) => sum + c.total_shift, 0) / convergence.length : 0
  
  const getSeverityColor = (shift: number) => {
    if (shift > 50) return 'bg-red-500'
    if (shift > 20) return 'bg-yellow-500'
    return 'bg-green-500'
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5" />
        Convergence Monitoring
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Max Shift</p>
          <p className="text-2xl font-bold">{maxShift.toFixed(2)} mm</p>
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Average Shift</p>
          <p className="text-2xl font-bold">{avgShift.toFixed(2)} mm</p>
        </div>
      </div>
      
      {convergence.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Point Measurements</h4>
          {convergence.slice(0, 5).map((point, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
              <span>{point.point_id}</span>
              <span className={`px-2 py-0.5 rounded text-white text-xs ${getSeverityColor(point.total_shift)}`}>
                {point.total_shift.toFixed(2)} mm
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
