'use client'

import { useCallback, useState } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Connection,
  MarkerType,
  Node,
  Edge
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { Waypoint } from '@/types/usv'

interface MissionPlannerProps {
  waypoints: Waypoint[]
  onChange?: (waypoints: Waypoint[]) => void
  onSave?: (waypoints: Waypoint[]) => void
  readOnly?: boolean
}

interface WaypointNode extends Node {
  data: {
    label: string
    waypoint: Waypoint
  }
}

export default function MissionPlanner({
  waypoints,
  onChange,
  onSave,
  readOnly = false
}: MissionPlannerProps) {
  const initialNodes: WaypointNode[] = waypoints.map((wp, idx) => ({
    id: wp.id,
    position: {
      x: 150 + (idx % 4) * 200,
      y: 100 + Math.floor(idx / 4) * 150
    },
    data: {
      label: `WP${wp.order}: ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}`,
      waypoint: wp
    },
    type: 'default',
    draggable: !readOnly
  }))

  const initialEdges: Edge[] = waypoints
    .slice(0, -1)
    .map((wp, idx) => ({
      id: `e${wp.id}-${waypoints[idx + 1].id}`,
      source: wp.id,
      target: waypoints[idx + 1].id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true
    }))

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback((params: Connection) => {
    if (readOnly) return
    setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds))
  }, [setEdges, readOnly])

  const handleSave = () => {
    const updatedWaypoints: Waypoint[] = nodes
      .sort((a: any, b: any) => a.position.x - b.position.x || a.position.y - b.position.y)
      .map((node, idx) => ({
        ...node.data.waypoint,
        order: idx
      }))
    onSave?.(updatedWaypoints)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
        <h3 className="font-semibold text-sm">Mission Planner</h3>
        <div className="flex gap-2">
          <span className="text-xs text-[var(--text-muted)]">
            {waypoints.length} waypoints
          </span>
          {!readOnly && (
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Mission
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-[400px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
