import { db } from '@/lib/db'
import type { SurveyJob, JobApplication, JobReview } from '@/types/jobs'
import type { PeerReviewRequest, PeerReviewer } from '@/types/peerReview'
import type { SurveyorProfile } from '@/lib/api-client/community'

export interface CommunityStats {
  totalSurveyors: number
  totalJobsPosted: number
  totalReviewsCompleted: number
  totalCPDPointsAwarded: number
}

type DbRow = Record<string, unknown>

function rowToJob(row: DbRow): SurveyJob {
  return {
    id: row.id as string,
    postedBy: row.posted_by as string,
    title: row.title as string,
    description: row.description as string,
    jobType: row.job_type as string,
    county: row.county as string,
    locationDescription: row.location_description as string,
    parcelNumber: row.parcel_number as string,
    estimatedArea: row.estimated_area as number,
    budget: {
      amount: (row.budget_amount as number) || 0,
      currency: (row.budget_currency as string) || 'KES',
      type: (row.budget_type as string) || 'FIXED',
    },
    deadline: row.deadline as string,
    requiredQualifications: (row.required_quals as string[]) || [],
    status: row.status as string,
    createdAt: row.created_at as string,
    awardedTo: row.awarded_to as string,
    completedAt: row.completed_at as string,
    commissionPaid: (row.commission_paid as boolean) ?? false,
    updatedAt: (row.updated_at ?? row.created_at) as string,
  } as unknown as SurveyJob
}

function rowToProfile(row: DbRow): SurveyorProfile {
  return {
    userId: row.user_id as string,
    displayName: row.display_name as string,
    iskNumber: row.isk_number as string,
    firmName: row.firm_name as string,
    county: row.county as string,
    specializations: (row.specializations as string[]) || [],
    yearsExperience: row.years_experience as number,
    bio: row.bio as string,
    profilePublic: row.profile_public !== false,
    averageRating: (row.average_rating as number) || 0,
    totalReviews: (row.total_reviews as number) || 0,
    jobsCompleted: (row.jobs_completed as number) || 0,
    verifiedIsk: (row.verified_isk as boolean) || false,
    createdAt: row.created_at as string,
  } as SurveyorProfile
}

export async function getOpenJobs(filters?: {
  jobType?: string
  county?: string
  minBudget?: number
  maxBudget?: number
}): Promise<SurveyJob[]> {
  const query = `
    SELECT * FROM survey_jobs 
    WHERE status = 'OPEN' 
    ORDER BY created_at DESC
  `
  const params: unknown[] = []

  const result = await db.query(query, params)
  return result.rows.map((row: DbRow) => rowToJob(row))
}

export async function getJobById(id: string): Promise<SurveyJob | null> {
  const result = await db.query(
    'SELECT * FROM survey_jobs WHERE id = $1',
    [id]
  )
  if (result.rows.length === 0) return null
  return rowToJob(result.rows[0] as DbRow)
}

export async function createJob(job: Partial<SurveyJob>, userId: string): Promise<string> {
  const result = await db.query(
    `INSERT INTO survey_jobs (
      posted_by, title, description, job_type, county, 
      location_description, parcel_number, estimated_area,
      budget_amount, budget_currency, budget_type, deadline, required_quals
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id`,
    [
      userId, job.title, job.description, job.jobType, job.county,
      job.locationDescription, job.parcelNumber, job.estimatedArea,
      job.budget?.amount, job.budget?.currency || 'KES', job.budget?.type || 'FIXED',
      job.deadline, job.requiredQualifications || []
    ]
  )
  return result.rows[0].id
}

export async function applyToJob(jobId: string, application: Partial<JobApplication>, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO job_applications (
      job_id, surveyor_id, cover_letter, proposed_amount, 
      proposed_currency, proposed_timeline, portfolio_links
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      jobId, userId, application.coverLetter, application.proposedAmount || 0,
      application.proposedCurrency || 'KES', application.proposedTimeline || 7,
      application.portfolioLinks || []
    ]
  )
}

export async function awardJob(jobId: string, surveyorId: string): Promise<void> {
  await db.query(
    `UPDATE survey_jobs SET status = 'AWARDED', awarded_to = $1 WHERE id = $2`,
    [surveyorId, jobId]
  )
  await db.query(
    `UPDATE job_applications SET status = 'AWARDED' WHERE job_id = $1 AND surveyor_id = $2`,
    [jobId, surveyorId]
  )
}

export async function completeJob(jobId: string): Promise<void> {
  await db.query(
    `UPDATE survey_jobs SET status = 'COMPLETED', completed_at = $1 WHERE id = $2`,
    [new Date().toISOString(), jobId]
  )
}

export async function getSurveyorProfile(userId: string): Promise<SurveyorProfile | null> {
  const result = await db.query(
    'SELECT * FROM surveyor_profiles WHERE user_id = $1',
    [userId]
  )
  if (result.rows.length === 0) return null
  return rowToProfile(result.rows[0] as DbRow)
}

export async function createOrUpdateProfile(userId: string, profile: Partial<SurveyorProfile>): Promise<void> {
  await db.query(
    `INSERT INTO surveyor_profiles (
      user_id, display_name, isk_number, firm_name, county,
      specializations, years_experience, bio, profile_public
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      isk_number = EXCLUDED.isk_number,
      firm_name = EXCLUDED.firm_name,
      county = EXCLUDED.county,
      specializations = EXCLUDED.specializations,
      years_experience = EXCLUDED.years_experience,
      bio = EXCLUDED.bio,
      profile_public = EXCLUDED.profile_public`,
    [
      userId, profile.displayName, profile.iskNumber, profile.firmName,
      profile.county, profile.specializations || [], profile.yearsExperience,
      profile.bio, profile.profilePublic !== false
    ]
  )
}

export async function getSurveyors(filters?: {
  county?: string
  specialization?: string
}): Promise<SurveyorProfile[]> {
  const query = `
    SELECT * FROM surveyor_profiles 
    WHERE profile_public = true
    ORDER BY average_rating DESC
  `
  const params: unknown[] = []

  const result = await db.query(query, params)
  return result.rows.map((row: DbRow) => ({
    ...rowToProfile(row),
    id: row.id as string,
    totalJobs: (row.total_jobs as number) || 0,
  })) as SurveyorProfile[]
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const [surveyors, jobs, reviews, cpd] = await Promise.all([
    db.query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
    db.query<{ count: string }>("SELECT COUNT(*) as count FROM survey_jobs WHERE status = 'OPEN'"),
    db.query<{ count: string }>('SELECT COUNT(*) as count FROM peer_reviews WHERE status = $1', ['COMPLETED']),
    db.query<{ total: string | null }>('SELECT SUM(points) as total FROM cpd_records')
  ])

  return {
    totalSurveyors: parseInt(surveyors.rows[0]?.count || '0'),
    totalJobsPosted: parseInt(jobs.rows[0]?.count || '0'),
    totalReviewsCompleted: parseInt(reviews.rows[0]?.count || '0'),
    totalCPDPointsAwarded: parseInt(cpd.rows[0]?.total || '0')
  }
}

export async function awardJobAsComplete(jobId: string): Promise<void> {
  await db.query(
    `UPDATE survey_jobs SET status = 'COMPLETED', completed_at = $1 WHERE id = $2`,
    [new Date().toISOString(), jobId]
  )
}

export async function completeJobAsComplete(jobId: string): Promise<void> {
  await completeJob(jobId)
}

export async function getOpenPeerReviews(): Promise<PeerReviewRequest[]> {
  const result = await db.query(
    "SELECT * FROM peer_review_requests WHERE status = 'OPEN' ORDER BY created_at DESC"
  )
  return result.rows.map((row: DbRow) => ({
    id: row.id as string,
    requesterId: row.requester_id as string,
    projectId: row.project_id as string,
    submittedBy: (row.submitted_by ?? row.requester_id) as string,
    documentType: (row.document_type ?? 'general') as string,
    documentId: (row.document_id ?? row.project_id) as string,
    urgency: (row.urgency ?? 'NORMAL') as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as string,
    requestedAt: row.requested_at as string,
    createdAt: (row.created_at ?? row.requested_at) as string,
    completedAt: row.completed_at as string,
  })) as PeerReviewRequest[]
}

interface ReviewComment {
  section: string
  severity: string
  comment: string
  regulationCite?: string
}

export async function submitPeerReview(
  requestId: string,
  reviewerId: string,
  verdict: string,
  comments: ReviewComment[]
): Promise<void> {
  const reviewerResult = await db.query(
    `INSERT INTO peer_reviewers (request_id, reviewer_id, verdict, completed_at, cpd_points)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [requestId, reviewerId, verdict, new Date().toISOString(), verdict === 'APPROVED' ? 2 : 1]
  )

  if (reviewerResult.rows.length > 0 && comments.length > 0) {
    const reviewerPkId = reviewerResult.rows[0].id
    for (const c of comments) {
      await db.query(
        `INSERT INTO review_comments (reviewer_id_fk, section, severity, comment, regulation_cite)
         VALUES ($1, $2, $3, $4, $5)`,
        [reviewerPkId, c.section, c.severity, c.comment, c.regulationCite]
      )
    }
  }

  await db.query(
    "UPDATE peer_review_requests SET status = 'COMPLETE' WHERE id = $1",
    [requestId]
  )
}
