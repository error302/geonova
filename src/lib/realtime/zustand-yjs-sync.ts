import { useProjectStore, ProjectData } from '@/stores/projectStore'
import { realtimeService } from './index'
import * as Y from 'yjs'

// Track active syncs to avoid duplicate listeners
const activeSyncs = new Set<string>()

export function initProjectSync(projectId: string) {
  if (activeSyncs.has(projectId)) return
  activeSyncs.add(projectId)

  const doc = realtimeService.getDoc(projectId)
  const yProject = doc.getMap<any>('project')

  // 1. Initial Load: If Yjs has data, push it to Zustand
  if (Array.from(yProject.keys()).length > 0) {
    const projectData = yProject.toJSON() as ProjectData
    useProjectStore.getState().loadProject(projectData)
  } else {
    // If Yjs is empty, initialize it from Zustand
    const state = useProjectStore.getState()
    const project = state.projects[projectId]
    if (project) {
      doc.transact(() => {
        Object.entries(project).forEach(([key, value]) => {
          yProject.set(key, value)
        })
      })
    }
  }

  // 2. Yjs -> Zustand (Observe changes from other tablets)
  yProject.observe((event) => {
    // Prevent echo loops by checking if we caused this change
    if (event.transaction.local) return

    const updatedData = yProject.toJSON() as ProjectData
    useProjectStore.getState().loadProject(updatedData)
  })

  // 3. Zustand -> Yjs (Observe local changes and push to mesh)
  useProjectStore.subscribe(
    (state) => state.projects[projectId],
    (project, prevProject) => {
      if (!project) return
      
      // We only want to push to Yjs if this change came from the local user
      // A simple way to check is to diff the objects.
      // But since Yjs handles merges cleanly, we can just dump it in.
      
      doc.transact(() => {
        // We do a naive replace of the top-level keys
        // For a production app, we would observe nested properties (ControlPoints Map, etc.)
        // But Y.Map set() overwrites cleanly.
        Object.entries(project).forEach(([key, value]) => {
          const currentY = yProject.get(key)
          // Naive deep equality check to avoid unnecessary writes
          if (JSON.stringify(currentY) !== JSON.stringify(value)) {
            yProject.set(key, value)
          }
        })
      })
    },
    { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
  )
}
