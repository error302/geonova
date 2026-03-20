/**
 * Peer Review — user-submitted survey plan reviews.
 * Surveyors post their computation sheets / plans for community feedback.
 * All data persisted to localStorage. No fake reviewer profiles.
 */

export type ReviewStatus = 'open' | 'reviewed' | 'closed'
export type SurveyTypeOption = 'traverse' | 'leveling' | 'boundary' | 'topographic' | 'engineering' | 'gnss' | 'mining' | 'other'

export interface ReviewRequest {
  id: string
  projectName: string
  surveyType: SurveyTypeOption
  description: string         // What the submitter wants reviewed
  country: string
  submitterName: string
  submitterContact: string
  attachmentNote: string      // Link to GeoNova project or external URL
  status: ReviewStatus
  postedAt: string
  comments: ReviewComment[]
}

export interface ReviewComment {
  id: string
  requestId: string
  reviewerName: string
  reviewerTitle: string        // e.g. "LSK Member" or "BSc Surveying"
  comment: string
  category: 'precision' | 'compliance' | 'methodology' | 'documentation' | 'general'
  rating: 1 | 2 | 3 | 4 | 5  // 5 = no issues found
  postedAt: string
}

const REQ_KEY  = 'geonova_review_requests'
const COM_KEY  = 'geonova_review_comments'

function loadRequests(): ReviewRequest[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(REQ_KEY) || '[]') } catch { return [] }
}
function saveRequests(r: ReviewRequest[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(REQ_KEY, JSON.stringify(r))
}
function loadComments(): ReviewComment[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(COM_KEY) || '[]') } catch { return [] }
}
function saveComments(c: ReviewComment[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(COM_KEY, JSON.stringify(c))
}

export function getRequests(status?: ReviewStatus): ReviewRequest[] {
  const all = loadRequests().sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  return status ? all.filter(r => r.status === status) : all
}

export function postRequest(data: Omit<ReviewRequest, 'id' | 'postedAt' | 'comments' | 'status'>): ReviewRequest {
  const req: ReviewRequest = {
    ...data, id: `rev_${Date.now()}`,
    postedAt: new Date().toISOString(), status: 'open', comments: [],
  }
  saveRequests([req, ...loadRequests()])
  return req
}

export function postComment(data: Omit<ReviewComment, 'id' | 'postedAt'>): ReviewComment {
  const comment: ReviewComment = { ...data, id: `com_${Date.now()}`, postedAt: new Date().toISOString() }
  const comments = loadComments()
  saveComments([...comments, comment])
  // Update comment count on request
  const requests = loadRequests()
  const idx = requests.findIndex(r => r.id === data.requestId)
  if (idx !== -1) {
    requests[idx] = { ...requests[idx], comments: [...requests[idx].comments, comment], status: 'reviewed' }
    saveRequests(requests)
  }
  return comment
}

export function closeRequest(id: string) {
  const requests = loadRequests()
  const idx = requests.findIndex(r => r.id === id)
  if (idx !== -1) { requests[idx] = { ...requests[idx], status: 'closed' }; saveRequests(requests) }
}

export function deleteRequest(id: string) {
  saveRequests(loadRequests().filter(r => r.id !== id))
  saveComments(loadComments().filter(c => c.requestId !== id))
}

export const SURVEY_TYPES: { id: SurveyTypeOption; label: string }[] = [
  { id: 'traverse',    label: 'Traverse / Control' },
  { id: 'leveling',    label: 'Leveling' },
  { id: 'boundary',    label: 'Boundary Survey' },
  { id: 'topographic', label: 'Topographic Survey' },
  { id: 'engineering', label: 'Engineering Setout' },
  { id: 'gnss',        label: 'GNSS Baseline' },
  { id: 'mining',      label: 'Mine Survey' },
  { id: 'other',       label: 'Other' },
]

export const CATEGORIES: { id: ReviewComment['category']; label: string }[] = [
  { id: 'precision',      label: 'Precision & closure' },
  { id: 'compliance',     label: 'Standards compliance' },
  { id: 'methodology',    label: 'Field methodology' },
  { id: 'documentation',  label: 'Documentation' },
  { id: 'general',        label: 'General feedback' },
]

export const COUNTRIES = ['Kenya','Uganda','Tanzania','Nigeria','Ghana','South Africa','Rwanda','Other']
