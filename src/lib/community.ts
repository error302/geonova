import db from '@/lib/db'
import type { SurveyJob, JobApplication, JobReview, SurveyorProfile } from '@/types/jobs'
import type { PeerReviewRequest, PeerReviewer } from '@/types/peerReview'

export interface CommunityStats {
  totalSurveyors: number
  totalJobsPosted: number
  totalReviewsCompleted: number
  totalCPDPointsAwarded: number
}

export async function getOpenJobs(filters?: {
  jobType?: string
  county?: string
  minBudget?: number
  maxBudget?: number
}): Promise<SurveyJob[]> {
  let query = `
    SELECT * FROM survey_jobs 
    WHERE status = 'OPEN' 
    ORDER BY created_at DESC
  `
  const params: unknown[] = []

  const result = await db.query(query, params)
  return result.rows.map((row: any) => ({
    id: row.id,
    postedBy: row.posted_by,
    title: row.title,
    description: row.description,
    jobType: row.job_type,
    county: row.county,
    locationDescription: row.location_description,
    parcelNumber: row.parcel_number,
    estimatedArea: row.estimated_area,
    budget: {
      amount: row.budget_amount || 0,
      currency: row.budget_currency || 'KES',
      type: row.budget_type || 'FIXED'
    },
    deadline: row.deadline,
    requiredQualifications: row.required_quals || [],
    status: row.status,
    createdAt: row.created_at,
    awardedTo: row.awarded_to,
    completedAt: row.completed_at,
    commissionPaid: row.commission_paid ?? false,
    updatedAt: row.updated_at ?? row.created_at
  })) as unknown as SurveyJob[]
}

export async function getJobById(id: string): Promise<SurveyJob | null> {
  const result = await db.query(
    'SELECT * FROM survey_jobs WHERE id = $1',
    [id]
  )
  if (result.rows.length === 0) return null
  
  const row = result.rows[0]
  return {
    id: row.id,
    postedBy: row.posted_by,
    title: row.title,
    description: row.description,
    jobType: row.job_type,
    county: row.county,
    locationDescription: row.location_description,
    parcelNumber: row.parcel_number,
    estimatedArea: row.estimated_area,
    budget: {
      amount: row.budget_amount || 0,
      currency: row.budget_currency || 'KES',
      type: row.budget_type || 'FIXED'
    },
    deadline: row.deadline,
    requiredQualifications: row.required_quals || [],
    status: row.status,
    createdAt: row.created_at,
    awardedTo: row.awarded_to,
    completedAt: row.completed_at,
    commissionPaid: row.commission_paid ?? false,
    updatedAt: row.updated_at ?? row.created_at
  } as SurveyJob
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
  const row = result.rows[0]
  return {
    userId: row.user_id,
    displayName: row.display_name,
    iskNumber: row.isk_number,
    firmName: row.firm_name,
    county: row.county,
    specializations: row.specializations || [],
    yearsExperience: row.years_experience,
    bio: row.bio,
    profilePublic: row.profile_public !== false,
    averageRating: row.average_rating || 0,
    totalReviews: row.total_reviews || 0,
    jobsCompleted: row.jobs_completed || 0,
    verifiedIsk: row.verified_isk || false,
    createdAt: row.created_at
  } as SurveyorProfile
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
  let query = `
    SELECT * FROM surveyor_profiles 
    WHERE profile_public = true
    ORDER BY average_rating DESC
  `
  const params: unknown[] = []

  const result = await db.query(query, params)
  return result.rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    iskNumber: row.isk_number,
    firmName: row.firm_name,
    county: row.county,
    specializations: row.specializations || [],
    yearsExperience: row.years_experience,
    bio: row.bio,
    profilePublic: row.profile_public !== false,
    averageRating: row.average_rating || 0,
    totalReviews: row.total_reviews || 0,
    totalJobs: row.total_jobs || 0,
    jobsCompleted: row.jobs_completed || 0,
    verifiedIsk: row.verified_isk || false,
    createdAt: row.created_at
  })) as SurveyorProfile[]
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const [surveyors, jobs, reviews, cpd] = await Promise.all([
    db.query('SELECT COUNT(*) as count FROM users'),
    db.query("SELECT COUNT(*) as count FROM survey_jobs WHERE status = 'OPEN'"),
    db.query('SELECT COUNT(*) as count FROM peer_reviews WHERE status = $1', ['COMPLETED']),
    db.query('SELECT SUM(points) as total FROM cpd_records')
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
  return result.rows.map((row: any) => ({
    id: row.id,
    requesterId: row.requester_id,
    projectId: row.project_id,
    submittedBy: row.submitted_by || row.requester_id,
    documentType: row.document_type || 'general',
    documentId: row.document_id || row.project_id,
    urgency: row.urgency || 'NORMAL',
    title: row.title,
    description: row.description,
    status: row.status,
    requestedAt: row.requested_at,
    createdAt: row.created_at || row.requested_at,
    completedAt: row.completed_at
  })) as PeerReviewRequest[]
}

export async function submitPeerReview(
  requestId: string,
  reviewerId: string,
  verdict: string,
  comments: unknown[]
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
        [reviewerPkId, (c as any).section, (c as any).severity, (c as any).comment, (c as any).regulationCite]
      )
    }
  }

  await db.query(
    "UPDATE peer_review_requests SET status = 'COMPLETE' WHERE id = $1",
    [requestId]
  )
}
