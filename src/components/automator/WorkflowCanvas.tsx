'use client'

import { useCallback, useState } from 'react'
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Connection,
  Node,
  Edge
} from 'reactflow'
import 'reactflow/dist/style.css'

const nodeTypes = [
  { type: 'fieldbook', label: 'Fieldbook', color: '#3b82f6' },
  { type: 'fieldguard', label: 'FieldGuard AI', color: '#10b981' },
  { type: 'cadastra', label: 'Cadastra Validator', color: '#8b5cf6' },
  { type: 'developPlan', label: 'Develop Plan', color: '#f59e0b' },
  { type: 'validate', label: 'Validate', color: '#ef4444' },
  { type: 'approve', label: 'Approve', color: '#ec4899' },
  { type: 'export', label: 'Export', color: '#06b6d4' }
]

interface WorkflowCanvasProps {
  onSave?: (nodes: Node[], edges: Edge[]) => void
}

export default function WorkflowCanvas({ onSave }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds))
  }, [setEdges])
  
  const handleSave = () => {
    onSave?.(nodes, edges)
  }
  
  return (
    <div className="flex h-full">
      <div className="w-64 bg-gray-100 dark:bg-gray-800 p-4 border-r">
        <h3 className="font-semibold mb-4">Node Types</h3>
        <div className="space-y-2">
          {nodeTypes.map((nt) => (
            <div
              key={nt.type}
              className="p-2 rounded cursor-move text-white text-sm"
              style={{ backgroundColor: nt.color }}
            >
              {nt.label}
            </div>
          ))}
        </div>
        
        <button
          onClick={handleSave}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Save Workflow
        </button>
      </div>
      
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
