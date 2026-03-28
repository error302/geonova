export interface UniversityLicense {
  id: string
  organizationId: string
  universityName: string
  department: string
  country: string
  studentSeatCount: number
  lecturerSeatCount: number
  apiKey: string
  allowedEndpoints: string[]
  rateLimitPerDay: number
  academicYear: string
  expiresAt: string
}

export interface CourseIntegration {
  id: string
  licenseId: string
  courseName: string
  courseCode: string
  lecturerId: string
  studentIds: string[]
  assignmentTemplates: AssignmentTemplate[]
}

export interface AssignmentTemplate {
  id: string
  title: string
  toolType: string
  inputData: Record<string, unknown>
  expectedOutputs: Record<string, unknown>
  allowedAttempts: number
}
