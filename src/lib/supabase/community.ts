import { createClient } from '@supabase/supabase-js'
import type { SurveyJob, JobApplication, JobReview, SurveyorProfile } from '@/types/jobs'
import type { PeerReviewRequest, PeerReviewer } from '@/types/peerReview'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export interface CommunityStats {
  totalSurveyors: number
  totalJobsPosted: number
  totalReviewsCompleted: number
  totalCPDPointsAwarded: number
}

// Jobs
export async function getOpenJobs(filters?: {
  jobType?: string
  county?: string
  minBudget?: number
  maxBudget?: number
}): Promise<SurveyJob[]> {
  let query = supabase
    .from('survey_jobs')
    .select('*')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })

  if (filters?.county) query = query.eq('county', filters.county)
  if (filters?.jobType) query = query.eq('job_type', filters.jobType)
  if (filters?.minBudget) query = query.gte('budget_amount', filters.minBudget)
  if (filters?.maxBudget) query = query.lte('budget_amount', filters.maxBudget)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getJobById(id: string): Promise<SurveyJob | null> {
  const { data, error } = await supabase
    .from('survey_jobs')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createJob(job: Partial<SurveyJob>, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('survey_jobs')
    .insert({
      posted_by: userId,
      title: job.title,
      description: job.description,
      job_type: job.jobType,
      county: job.county,
      location_description: job.locationDescription,
      parcel_number: job.parcelNumber,
      estimated_area: job.estimatedArea,
      budget_amount: job.budget?.amount,
      budget_currency: job.budget?.currency || 'KES',
      budget_type: job.budget?.type || 'FIXED',
      deadline: job.deadline,
      required_quals: job.requiredQualifications || []
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

export async function applyToJob(jobId: string, application: Partial<JobApplication>, userId: string): Promise<void> {
  await supabase
    .from('job_applications')
    .insert({
      job_id: jobId,
      surveyor_id: userId,
      cover_letter: application.coverLetter,
      proposed_amount: application.proposedAmount || 0,
      proposed_currency: application.proposedCurrency || 'KES',
      proposed_timeline: application.proposedTimeline || 7,
      portfolio_links: application.portfolioLinks || []
    })
}

export async function awardJob(jobId: string, surveyorId: string): Promise<void> {
  await supabase
    .from('survey_jobs')
    .update({ status: 'AWARDED', awarded_to: surveyorId })
    .eq('id', jobId)

  await supabase
    .from('job_applications')
    .update({ status: 'AWARDED' })
    .eq('job_id', jobId)
    .eq('surveyor_id', surveyorId)
}

export async function completeJob(jobId: string): Promise<void> {
  await supabase
    .from('survey_jobs')
    .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
    .eq('id', jobId)
}

// Surveyor Profiles
export async function getSurveyorProfile(userId: string): Promise<SurveyorProfile | null> {
  const { data, error } = await supabase
    .from('surveyor_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

export async function createOrUpdateProfile(userId: string, profile: Partial<SurveyorProfile>): Promise<void> {
  await supabase
    .from('surveyor_profiles')
    .upsert({
      user_id: userId,
      display_name: profile.displayName,
      isk_number: profile.iskNumber,
      firm_name: profile.firmName,
      county: profile.county,
      specializations: profile.specializations || [],
      years_experience: profile.yearsExperience,
      bio: profile.bio,
      profile_public: profile.profilePublic !== false
    }, { onConflict: 'user_id' })
}

export async function getSurveyors(filters?: {
  county?: string
  specialization?: string
}): Promise<SurveyorProfile[]> {
  let query = supabase
    .from('surveyor_profiles')
    .select('*')
    .eq('profile_public', true)
    .order('average_rating', { ascending: false })

  if (filters?.county) query = query.eq('county', filters.county)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// Peer Reviews
export async function getOpenPeerReviews(): Promise<PeerReviewRequest[]> {
  const { data, error } = await supabase
    .from('peer_review_requests')
    .select('*')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function submitPeerReview(
  requestId: string,
  reviewerId: string,
  verdict: string,
  comments: any[]
): Promise<void> {
  const { data: reviewer } = await supabase
    .from('peer_reviewers')
    .insert({
      request_id: requestId,
      reviewer_id: reviewerId,
      verdict,
      completed_at: new Date().toISOString(),
      cpd_points: verdict === 'APPROVED' ? 2 : 1
    })
    .select()
    .single()

  if (reviewer && comments.length > 0) {
    await supabase
      .from('review_comments')
      .insert(
        comments.map((c: any) => ({
          reviewer_id_fk: reviewer.id,
          section: c.section,
          severity: c.severity,
          comment: c.comment,
          regulation_cite: c.regulationCite
        }))
      )
  }

  await supabase
    .from('peer_review_requests')
    .update({ status: 'COMPLETE' })
    .eq('id', requestId)
}

// Community Stats
export async function getCommunityStats(): Promise<CommunityStats> {
  const [surveyors, jobs, reviews, cpd] = await Promise.all([
    supabase.from('surveyor_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('survey_jobs').select('id', { count: 'exact', head: true }),
    supabase.from('job_reviews').select('id', { count: 'exact', head: true }),
    supabase.from('cpd_records').select('points', { count: 'exact', head: false })
  ])

  const totalCPD = (cpd.data || []).reduce((sum, r) => sum + (r.points || 0), 0)

  return {
    totalSurveyors: surveyors.count || 0,
    totalJobsPosted: jobs.count || 0,
    totalReviewsCompleted: reviews.count || 0,
    totalCPDPointsAwarded: totalCPD
  }
}
