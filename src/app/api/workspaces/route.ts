/**
 * GET /api/workspaces?surveyType=cadastral
 *
 * Returns the workspace configuration for the given survey type.
 * If surveyType is omitted, returns all available workspaces.
 *
 * Used by the frontend to morph the UI based on the active workspace
 * (tool categories, map layers, hotkeys, document types).
 */

export const dynamic = 'force-dynamic'

import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import {
  getWorkspaceConfig,
  listWorkspaces,
  autoDetectWorkspace,
  type WorkspaceId,
} from '@/lib/workspaces/config'

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const url = new URL(req.url)
    const surveyType = url.searchParams.get('surveyType')

    if (surveyType) {
      // Auto-detect workspace from survey type and return its config
      const workspaceId = autoDetectWorkspace(surveyType)
      const config = getWorkspaceConfig(workspaceId)
      return apiSuccess({ workspace: config })
    }

    // No surveyType — return all workspaces for the switcher UI
    const workspaces = listWorkspaces()
    return apiSuccess({ workspaces })
  }
)
