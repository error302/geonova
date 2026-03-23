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
  attachmentNote: string      // Link to METARDU project or external URL
  status: ReviewStatus
  paymentStatus?: string
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

import { createClient } from '../supabase/client'

export async function getRequests(status?: ReviewStatus): Promise<ReviewRequest[]> {
  if (typeof window === 'undefined') return []
  const supabase = createClient()
  
  let q = supabase.from('peer_reviews').select(`
    id, project_name, survey_type, description, country, submitter_name, submitter_contact, 
    attachment_note, status, posted_at, payment_status,
    peer_review_comments(id, request_id, reviewer_name, reviewer_title, comment, category, rating, posted_at)
  `).order('posted_at', { ascending: false })
  
  if (status) q = q.eq('status', status)
    
  const { data } = await q
  if (!data) return []
  
  return data.map((r: any) => ({
    id: r.id,
    projectName: r.project_name,
    surveyType: r.survey_type as SurveyTypeOption,
    description: r.description,
    country: r.country,
    submitterName: r.submitter_name,
    submitterContact: r.submitter_contact,
    attachmentNote: r.attachment_note,
    status: r.status as ReviewStatus,
    paymentStatus: r.payment_status,
    postedAt: r.posted_at,
    comments: (r.peer_review_comments || []).map((c: any) => ({
      id: c.id,
      requestId: c.request_id,
      reviewerName: c.reviewer_name,
      reviewerTitle: c.reviewer_title,
      comment: c.comment,
      category: c.category,
      rating: c.rating,
      postedAt: c.posted_at
    }))
  }))
}

export async function postRequest(data: Omit<ReviewRequest, 'id' | 'postedAt' | 'comments' | 'status' | 'paymentStatus'>): Promise<ReviewRequest> {
  const supabase = createClient()
  
  const { data: authData } = await supabase.auth.getUser()

  const { data: ret, error } = await supabase.from('peer_reviews').insert({
    user_id: authData?.user?.id || null,
    project_name: data.projectName,
    survey_type: data.surveyType,
    description: data.description,
    country: data.country,
    submitter_name: data.submitterName,
    submitter_contact: data.submitterContact,
    attachment_note: data.attachmentNote,
    status: 'open',
    payment_status: 'pending'
  }).select().single()
  
  if (error) throw new Error(error.message)
  
  return {
    ...data, id: ret.id, postedAt: ret.posted_at, status: 'open', comments: [], paymentStatus: 'pending'
  }
}

export async function postComment(data: Omit<ReviewComment, 'id' | 'postedAt'>): Promise<ReviewComment> {
  const supabase = createClient()
  
  const { data: ret, error } = await supabase.from('peer_review_comments').insert({
    request_id: data.requestId,
    reviewer_name: data.reviewerName,
    reviewer_title: data.reviewerTitle,
    comment: data.comment,
    category: data.category,
    rating: data.rating
  }).select().single()
  
  if (error) throw new Error(error.message)
  
  // Mark review as requested and bump updated_at
  await supabase.from('peer_reviews').update({ status: 'reviewed', updated_at: new Date().toISOString() }).eq('id', data.requestId)
  
  return { ...data, id: ret.id, postedAt: ret.posted_at }
}

export async function closeRequest(id: string) {
  const supabase = createClient()
  await supabase.from('peer_reviews').update({ status: 'closed' }).eq('id', id)
}

export async function deleteRequest(id: string) {
  const supabase = createClient()
  await supabase.from('peer_reviews').delete().eq('id', id)
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
