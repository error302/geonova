'use client'

import { useState } from 'react'
import WorkflowCanvas from '@/components/automator/WorkflowCanvas'
import { executeWorkflow, generateReport } from '@/lib/compute/workflowEngine'
import { Play, FileText, Loader2 } from 'lucide-react'
import type { Node, Edge } from 'reactflow'

export default function AutomatorPage() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<any>(null)
  
  const handleRunWorkflow = async (nodes: Node[], edges: Edge[]) => {
    setRunning(true)
    try {
      const result = await executeWorkflow(nodes as any[], edges as any[])
      setResults(result)
    } catch (err) {
      console.error(err)
    } finally {
      setRunning(false)
    }
  }
  
  const handleGenerateReport = async () => {
    setRunning(true)
    try {
      const report = await generateReport(
        { project: 'test' },
        ['summary', 'methodology', 'results', 'recommendations'],
        'technical'
      )
      setResults({ report })
    } catch (err) {
      console.error(err)
    } finally {
      setRunning(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">SurveyFlow Automator</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => handleRunWorkflow([], [])}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            Run Workflow
          </button>
          
          <button
            onClick={handleGenerateReport}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FileText className="h-5 w-5" />
            Generate Report
          </button>
        </div>
      </div>
      
      <div className="h-[600px] bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <WorkflowCanvas onSave={handleRunWorkflow} />
      </div>
      
      {results && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Results</h3>
          <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-x-auto">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
