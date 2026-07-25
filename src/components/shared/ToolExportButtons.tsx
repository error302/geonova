'use client'

/**
 * ToolExportButtons — shared Print + CSV buttons for simple calculator tools
 *
 * Usage:
 *   <ToolExportButtons
 *     title="Distance Calculation"
 *     rows={[
 *       { label: 'Horizontal Distance', value: '123.456 m' },
 *       { label: 'Bearing', value: '45°32\'08"', highlight: true },
 *     ]}
 *     csvRows={[['Horizontal Distance', '123.456'], ['Bearing', "45°32'08\""]]}
 *   />
 */

interface ToolExportButtonsProps {
  title: string
  rows: Array<{ label: string; value: string; highlight?: boolean }>
  csvRows?: (string | number)[][]
  reference?: string
  disabled?: boolean
}

export function ToolExportButtons({ title, rows, csvRows, reference, disabled }: ToolExportButtonsProps) {
  if (disabled) return null

  return (
    <div className="flex gap-2 mt-3">
      {csvRows && (
        <button
          onClick={() => {
            import('@/lib/export/toolExport').then(m => m.downloadResultCSV(title.toLowerCase().replace(/\s+/g, '-'), csvRows))
          }}
          className="btn btn-secondary text-xs"
        >
          Download CSV
        </button>
      )}
      <button
        onClick={() => {
          import('@/lib/export/toolExport').then(m => m.printResult(title, title, rows, reference))
        }}
        className="btn btn-secondary text-xs"
      >
        Print
      </button>
    </div>
  )
}
