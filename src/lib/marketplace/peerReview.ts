/**
 * Peer Review Network Service
 * Phase 9 - Community Features
 */

export interface ReviewRequest {
  id: string
  projectId: string
  projectName: string
  surveyType: 'traverse' | 'leveling' | 'boundary' | 'topographic' | 'engineering'
  submittedBy: string
  submittedAt: number
  status: 'pending' | 'in_review' | 'approved' | 'revision_requested' | 'rejected'
  reviewer?: string
  reviewedAt?: number
  comments?: ReviewComment[]
  overallRating?: number
}

export interface ReviewComment {
  id: string
  author: string
  authorTitle: string
  authorCountry: string
  content: string
  category: 'technical' | 'compliance' | 'precision' | 'documentation' | 'general'
  createdAt: number
  resolved: boolean
}

export interface ReviewerProfile {
  id: string
  name: string
  title: string
  country: string
  license: string
  specializations: string[]
  yearsExperience: number
  reviewsCompleted: number
  averageRating: number
  verified: boolean
  responseTime: string
}

const reviewers: ReviewerProfile[] = [
  {
    id: 'rev-001',
    name: 'Dr. Eng. Peter Ochieng',
    title: 'Registered Surveyor',
    country: 'Kenya',
    license: 'RS/2005/0234',
    specializations: ['Cadastral', 'Boundary', 'Subdivision'],
    yearsExperience: 20,
    reviewsCompleted: 156,
    averageRating: 4.9,
    verified: true,
    responseTime: '24 hours',
  },
  {
    id: 'rev-002',
    name: 'Eng. James Wambuzi',
    title: 'Geodetic Surveyor',
    country: 'Uganda',
    license: 'UGS/2010/0089',
    specializations: ['Geodetic', 'GNSS', 'Control Networks'],
    yearsExperience: 15,
    reviewsCompleted: 89,
    averageRating: 4.8,
    verified: true,
    responseTime: '48 hours',
  },
  {
    id: 'rev-003',
    name: 'Surveyor Ahmed Mwinyi',
    title: 'Chief Survey Officer',
    country: 'Tanzania',
    license: 'TS/2008/0456',
    specializations: ['Engineering', 'Mining', 'Topographic'],
    yearsExperience: 18,
    reviewsCompleted: 124,
    averageRating: 4.7,
    verified: true,
    responseTime: '24 hours',
  },
]

const pendingReviews: ReviewRequest[] = []

export function submitForReview(
  projectId: string,
  projectName: string,
  surveyType: ReviewRequest['surveyType'],
  submittedBy: string
): ReviewRequest {
  const request: ReviewRequest = {
    id: `review-${Date.now()}`,
    projectId,
    projectName,
    surveyType,
    submittedBy,
    submittedAt: Date.now(),
    status: 'pending',
    comments: [],
  }
  pendingReviews.push(request)
  return request
}

export function getReviewers(specialty?: string): ReviewerProfile[] {
  if (!specialty) return reviewers
  return reviewers.filter(r => 
    r.specializations.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
  )
}

export function getReviewerById(id: string): ReviewerProfile | undefined {
  return reviewers.find(r => r.id === id)
}

export function assignReviewer(reviewId: string, reviewerId: string): ReviewRequest | null {
  const review = pendingReviews.find(r => r.id === reviewId)
  if (review) {
    const reviewer = reviewers.find(r => r.id === reviewerId)
    if (reviewer) {
      review.reviewer = reviewer.name
      review.status = 'in_review'
    }
  }
  return review || null
}

export function addReviewComment(
  reviewId: string,
  author: string,
  authorTitle: string,
  authorCountry: string,
  content: string,
  category: ReviewComment['category']
): ReviewComment | null {
  const review = pendingReviews.find(r => r.id === reviewId)
  if (review) {
    const comment: ReviewComment = {
      id: `comment-${Date.now()}`,
      author,
      authorTitle,
      authorCountry,
      content,
      category,
      createdAt: Date.now(),
      resolved: false,
    }
    review.comments = review.comments || []
    review.comments.push(comment)
    return comment
  }
  return null
}

export function completeReview(
  reviewId: string,
  overallRating: number,
  status: ReviewRequest['status']
): ReviewRequest | null {
  const review = pendingReviews.find(r => r.id === reviewId)
  if (review) {
    review.status = status
    review.overallRating = overallRating
    review.reviewedAt = Date.now()
  }
  return review || null
}

export function getMyReviews(userId: string): ReviewRequest[] {
  return pendingReviews.filter(r => r.submittedBy === userId)
}

export function getAvailableReviews(): ReviewRequest[] {
  return pendingReviews.filter(r => r.status === 'pending')
}

export function getReviewCategories() {
  return [
    { id: 'technical', name: 'Technical Accuracy', description: 'Calculation correctness and methodology' },
    { id: 'compliance', name: 'Regulatory Compliance', description: 'Adherence to survey regulations' },
    { id: 'precision', name: 'Precision & Tolerance', description: '是否符合精度要求' },
    { id: 'documentation', name: 'Documentation', description: 'Report quality and completeness' },
    { id: 'general', name: 'General', description: 'Other observations' },
  ]
}

export function getReviewStatistics() {
  return {
    totalReviews: reviewers.reduce((sum, r) => sum + r.reviewsCompleted, 0),
    averageRating: reviewers.reduce((sum, r) => sum + r.averageRating, 0) / reviewers.length,
    availableReviewers: reviewers.length,
    pendingRequests: pendingReviews.filter(r => r.status === 'pending').length,
  }
}
