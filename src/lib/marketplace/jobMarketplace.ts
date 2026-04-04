/**
 * Survey Job Marketplace
 * User-posted jobs persisted in localStorage.
 * 5% commission model when completed.
 */

export type SurveyJobType = 'boundary' | 'topographic' | 'engineering' | 'mining' | 'hydrographic' | 'drone' | 'cadastral' | 'traverse' | 'leveling' | 'gnss' | 'stakeout' | 'other'
export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'
export type Currency = 'KES' | 'UGX' | 'TZS' | 'NGN' | 'USD' | 'GHS' | 'ZAR'

export interface SurveyJob {
  id: string
  title: string
  description: string
  surveyType: SurveyJobType
  country: string
  location: string
  budget: number
  currency: Currency
  deadline: string        // ISO date
  requiredSkills: string[]
  clientName: string
  clientContact: string   // phone or email
  status: JobStatus
  proposals: number
  postedAt: string        // ISO timestamp
  postedBy: string        // user ID or 'anonymous'
}

export interface JobProposal {
  id: string
  jobId: string
  surveyorName: string
  contact: string
  message: string
  quotedAmount: number
  currency: Currency
  submittedAt: string
}

const JOB_KEY = 'metardu_jobs'
const PROP_KEY = 'metardu_proposals'

function loadJobs(): SurveyJob[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(JOB_KEY) || '[]') } catch { return [] }
}
function saveJobs(jobs: SurveyJob[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(JOB_KEY, JSON.stringify(jobs))
}
function loadProposals(): JobProposal[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(PROP_KEY) || '[]') } catch { return [] }
}
function saveProposals(p: JobProposal[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROP_KEY, JSON.stringify(p))
}

export function getJobs(filters?: { country?: string; surveyType?: string; status?: JobStatus }): SurveyJob[] {
  let jobs = loadJobs().sort((a: any, b: any) => b.postedAt.localeCompare(a.postedAt))
  if (filters?.country) jobs = jobs.filter((j: any) => j.country === filters.country)
  if (filters?.surveyType) jobs = jobs.filter((j: any) => j.surveyType === filters.surveyType)
  if (filters?.status) jobs = jobs.filter((j: any) => j.status === filters.status)
  return jobs
}

export function getJobById(id: string): SurveyJob | undefined {
  return loadJobs().find((j: any) => j.id === id)
}

export function searchJobs(query: string): SurveyJob[] {
  const q = query.toLowerCase()
  return loadJobs().filter((j: any) =>
    j.title.toLowerCase().includes(q) ||
    j.description.toLowerCase().includes(q) ||
    j.location.toLowerCase().includes(q) ||
    j.surveyType.includes(q)
  )
}

export function postJob(data: Omit<SurveyJob, 'id' | 'proposals' | 'postedAt' | 'status'>): SurveyJob {
  const jobs = loadJobs()
  const job: SurveyJob = {
    ...data,
    id: `job_${Date.now()}`,
    status: 'open',
    proposals: 0,
    postedAt: new Date().toISOString(),
  }
  saveJobs([job, ...jobs])
  return job
}

export function updateJobStatus(id: string, status: JobStatus): boolean {
  const jobs = loadJobs()
  const idx = jobs.findIndex(j => j.id === id)
  if (idx === -1) return false
  jobs[idx] = { ...jobs[idx], status }
  saveJobs(jobs)
  return true
}

export function deleteJob(id: string) {
  saveJobs(loadJobs().filter((j: any) => j.id !== id))
}

export function submitProposal(data: Omit<JobProposal, 'id' | 'submittedAt'>): JobProposal {
  const proposals = loadProposals()
  const proposal: JobProposal = { ...data, id: `prop_${Date.now()}`, submittedAt: new Date().toISOString() }
  saveProposals([...proposals, proposal])
  // Increment proposal count on job
  const jobs = loadJobs()
  const idx = jobs.findIndex(j => j.id === data.jobId)
  if (idx !== -1) { jobs[idx] = { ...jobs[idx], proposals: jobs[idx].proposals + 1 }; saveJobs(jobs) }
  return proposal
}

export function getProposalsForJob(jobId: string): JobProposal[] {
  return loadProposals().filter((p: any) => p.jobId === jobId).sort((a: any, b: any) => b.submittedAt.localeCompare(a.submittedAt))
}

export const JOB_TYPES: { id: SurveyJobType; label: string }[] = [
  { id: 'boundary',    label: 'Boundary Survey' },
  { id: 'topographic', label: 'Topographic Survey' },
  { id: 'cadastral',   label: 'Cadastral Survey' },
  { id: 'traverse',    label: 'Traverse / Control' },
  { id: 'leveling',    label: 'Leveling' },
  { id: 'engineering', label: 'Engineering Setout' },
  { id: 'stakeout',    label: 'Stakeout' },
  { id: 'gnss',        label: 'GNSS Baseline' },
  { id: 'mining',      label: 'Mine Survey' },
  { id: 'hydrographic',label: 'Hydrographic Survey' },
  { id: 'drone',       label: 'Drone / UAV Survey' },
  { id: 'other',       label: 'Other' },
]

export const CURRENCIES: { id: Currency; symbol: string; country: string }[] = [
  { id: 'KES', symbol: 'KSh', country: 'Kenya' },
  { id: 'UGX', symbol: 'USh', country: 'Uganda' },
  { id: 'TZS', symbol: 'TSh', country: 'Tanzania' },
  { id: 'NGN', symbol: '₦',   country: 'Nigeria' },
  { id: 'GHS', symbol: 'GH₵', country: 'Ghana' },
  { id: 'ZAR', symbol: 'R',   country: 'South Africa' },
  { id: 'USD', symbol: '$',   country: 'International' },
]

export const COUNTRIES = ['Kenya','Uganda','Tanzania','Nigeria','Ghana','South Africa','Rwanda','Ethiopia','Zambia','Zimbabwe','Other']

export const COMMON_SKILLS = [
  'Total Station','GNSS/GPS','Leveling','AutoCAD','LandXML','DXF Export','Boundary Survey','Contours','Setting Out','Mine Survey','Drone Piloting','QGIS','Trimble Access','Leica','Topcon'
]

export function formatBudget(amount: number, currency: Currency): string {
  const c = CURRENCIES.find((c: any) => c.id === currency)
  const sym = c?.symbol ?? currency
  if (currency === 'KES' || currency === 'UGX' || currency === 'TZS' || currency === 'NGN') {
    return `${sym} ${amount.toLocaleString()}`
  }
  return `${sym}${amount.toLocaleString()}`
}
