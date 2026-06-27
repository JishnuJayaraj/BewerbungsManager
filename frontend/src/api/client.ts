import { z } from 'zod'
import {
  apiErrorSchema,
  applicationBriefRequestSchema,
  applicationBriefSchema,
  applicationListSchema,
  applicationPatchSchema,
  applicationSaveSchema,
  applicationSchema,
  autocompleteSuggestionSchema,
  basicSearchRequestSchema,
  cvParseRequestSchema,
  educationInputSchema,
  educationSchema,
  educationUpdateSchema,
  enrichApplyRequestSchema,
  enrichApplyResponseSchema,
  enrichQuestionsResultSchema,
  experienceInputSchema,
  experienceSchema,
  experienceUpdateSchema,
  healthSchema,
  jobDetailSchema,
  profileSchema,
  profileUpdateSchema,
  projectInputSchema,
  projectSchema,
  projectUpdateSchema,
  searchBodySchema,
  searchPresetCreateSchema,
  searchPresetListSchema,
  searchPresetSchema,
  quickFitSchema,
  searchResponseSchema,
  settingsSchema,
  suggestResponseSchema,
  skillInputSchema,
  skillSchema,
  skillUpdateSchema,
  fitResponseSchema,
  generatedArtifactListSchema,
  generatedArtifactSchema,
  generateRequestSchema,
  commsLogCreateSchema,
  commsLogListSchema,
  commsLogSchema,
  packageChecklistRequestSchema,
  packageChecklistSchema,
  requirementCheckSchema,
  requirementOverrideRequestSchema,
  type ApiErrorPayload,
  type Education,
  type EducationInput,
  type EducationUpdate,
  type EnrichAnswer,
  type EnrichApplyResponse,
  type EnrichQuestionsResult,
  type Application,
  type ApplicationBrief,
  type ApplicationBriefRequest,
  type ApplicationList,
  type ApplicationPatch,
  type CommsLogCreate,
  type CommsLogEntry,
  type AutocompleteSuggestion,
  type BasicSearchRequest,
  type Experience,
  type ExperienceInput,
  type ExperienceUpdate,
  type Health,
  type JobDetail,
  type JobSuggestion,
  type QuickFit,
  type Profile,
  type ProfileUpdate,
  type Project,
  type ProjectInput,
  type ProjectUpdate,
  type SearchBody,
  type SearchPreset,
  type SearchPresetCreate,
  type SearchPresetList,
  type SearchResponse,
  type Settings,
  type Skill,
  type SkillInput,
  type SkillUpdate,
  type FitResponse,
  type GeneratedArtifact,
  type GeneratedArtifactList,
  type GenerateRequest,
  type GeneratableArtifactKind,
  type PackageChecklist,
  type PackageChecklistRequest,
  type RequirementCheck,
  type RequirementStatus,
} from './schemas'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code
    this.details = payload.details
  }
}

type ApiRequestOptions<TSchema extends z.ZodType> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  schema: TSchema
}

async function apiRequest<TSchema extends z.ZodType>(
  path: string,
  options: ApiRequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers:
      options.body === undefined
        ? undefined
        : {
            'Content-Type': 'application/json',
          },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const rawBody = await readJson(response)

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(rawBody)
    if (parsedError.success) {
      throw new ApiError(response.status, parsedError.data.error)
    }
    throw new ApiError(response.status, {
      code: 'invalid_error_response',
      message: response.statusText || 'Request failed',
      details: {},
    })
  }

  const parsed = options.schema.safeParse(rawBody)
  if (!parsed.success) {
    throw new ApiError(response.status, {
      code: 'invalid_response',
      message: 'Backend response did not match the frontend contract',
      details: { issues: parsed.error.issues },
    })
  }

  return parsed.data
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function getHealth(): Promise<Health> {
  return apiRequest('/health', { schema: healthSchema })
}

export function getSettings(): Promise<Settings> {
  return apiRequest('/api/settings', { schema: settingsSchema })
}

export function basicSearch(input: BasicSearchRequest): Promise<SearchResponse> {
  return apiRequest('/api/search/basic', {
    method: 'POST',
    body: basicSearchRequestSchema.parse(input),
    schema: searchResponseSchema,
  })
}

export function advancedSearch(input: SearchBody): Promise<SearchResponse> {
  return apiRequest('/api/search/advanced', {
    method: 'POST',
    body: searchBodySchema.parse(input),
    schema: searchResponseSchema,
  })
}

export function autocompleteSearch(phrase: string, size = 8): Promise<AutocompleteSuggestion[]> {
  const params = new URLSearchParams({ phrase, size: String(size) })
  return apiRequest(`/api/search/autocomplete?${params.toString()}`, {
    schema: z.array(autocompleteSuggestionSchema),
  })
}

export function listSearchPresets(): Promise<SearchPresetList> {
  return apiRequest('/api/search/presets', { schema: searchPresetListSchema })
}

export function createSearchPreset(input: SearchPresetCreate): Promise<SearchPreset> {
  return apiRequest('/api/search/presets', {
    method: 'POST',
    body: searchPresetCreateSchema.parse(input),
    schema: searchPresetSchema,
  })
}

export function deleteSearchPreset(id: string): Promise<null> {
  return apiRequest(`/api/search/presets/${id}`, {
    method: 'DELETE',
    schema: z.null(),
  })
}

export function getJobDetail(uuid: string): Promise<JobDetail> {
  return apiRequest(`/api/jobs/${uuid}`, { schema: jobDetailSchema })
}

export function saveApplication(jobUuid: string): Promise<Application> {
  return apiRequest('/api/applications', {
    method: 'POST',
    body: applicationSaveSchema.parse({ job_uuid: jobUuid }),
    schema: applicationSchema,
  })
}

export function listApplications(): Promise<ApplicationList> {
  return apiRequest('/api/applications', { schema: applicationListSchema })
}

export function getApplication(id: string): Promise<Application> {
  return apiRequest(`/api/applications/${id}`, { schema: applicationSchema })
}

export function patchApplication(id: string, input: ApplicationPatch): Promise<Application> {
  return apiRequest(`/api/applications/${id}`, {
    method: 'PATCH',
    body: applicationPatchSchema.parse(input),
    schema: applicationSchema,
  })
}

export function deleteApplication(id: string): Promise<null> {
  return apiRequest(`/api/applications/${id}`, { method: 'DELETE', schema: z.null() })
}

export function getApplicationBrief(applicationId: string): Promise<ApplicationBrief> {
  return apiRequest(`/api/applications/${applicationId}/brief`, { schema: applicationBriefSchema })
}

export function updateApplicationBrief(
  applicationId: string,
  input: ApplicationBriefRequest,
): Promise<ApplicationBrief> {
  return apiRequest(`/api/applications/${applicationId}/brief`, {
    method: 'PUT',
    body: applicationBriefRequestSchema.parse(input),
    schema: applicationBriefSchema,
  })
}

export function getFit(applicationId: string): Promise<FitResponse> {
  return apiRequest(`/api/applications/${applicationId}/fit`, { schema: fitResponseSchema })
}

export function runFit(applicationId: string): Promise<FitResponse> {
  return apiRequest(`/api/applications/${applicationId}/fit`, {
    method: 'POST',
    schema: fitResponseSchema,
  })
}

export function updateRequirementOverride(
  applicationId: string,
  requirementId: string,
  userOverride: RequirementStatus | null,
): Promise<RequirementCheck> {
  return apiRequest(`/api/applications/${applicationId}/requirements/${requirementId}`, {
    method: 'PATCH',
    body: requirementOverrideRequestSchema.parse({ user_override: userOverride }),
    schema: requirementCheckSchema,
  })
}

export function getChecklist(applicationId: string): Promise<PackageChecklist> {
  return apiRequest(`/api/applications/${applicationId}/checklist`, { schema: packageChecklistSchema })
}

export function updateChecklist(
  applicationId: string,
  input: PackageChecklistRequest,
): Promise<PackageChecklist> {
  return apiRequest(`/api/applications/${applicationId}/checklist`, {
    method: 'PUT',
    body: packageChecklistRequestSchema.parse(input),
    schema: packageChecklistSchema,
  })
}

export function listComms(applicationId: string): Promise<{ items: CommsLogEntry[]; page: number; total: number }> {
  return apiRequest(`/api/applications/${applicationId}/comms`, { schema: commsLogListSchema })
}

export function createComms(applicationId: string, input: CommsLogCreate): Promise<CommsLogEntry> {
  return apiRequest(`/api/applications/${applicationId}/comms`, {
    method: 'POST',
    body: commsLogCreateSchema.parse(input),
    schema: commsLogSchema,
  })
}

export function deleteComms(applicationId: string, entryId: string): Promise<null> {
  return apiRequest(`/api/applications/${applicationId}/comms/${entryId}`, {
    method: 'DELETE',
    schema: z.null(),
  })
}

export function generateArtifact(applicationId: string, input: GenerateRequest): Promise<GeneratedArtifact> {
  return apiRequest(`/api/applications/${applicationId}/generate`, {
    method: 'POST',
    body: generateRequestSchema.parse(input),
    schema: generatedArtifactSchema,
  })
}

export function listArtifacts(
  applicationId: string,
  kind?: GeneratableArtifactKind,
): Promise<GeneratedArtifactList> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  return apiRequest(`/api/applications/${applicationId}/artifacts${query}`, {
    schema: generatedArtifactListSchema,
  })
}

export function getArtifact(artifactId: string): Promise<GeneratedArtifact> {
  return apiRequest(`/api/artifacts/${artifactId}`, { schema: generatedArtifactSchema })
}

export async function exportArtifact(
  artifactId: string,
  format: 'markdown' | 'pdf',
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/artifacts/${artifactId}/export?format=${encodeURIComponent(format)}`,
  )
  if (!response.ok) {
    const rawBody = await readJson(response)
    const parsedError = apiErrorSchema.safeParse(rawBody)
    if (parsedError.success) {
      throw new ApiError(response.status, parsedError.data.error)
    }
    throw new ApiError(response.status, {
      code: 'invalid_error_response',
      message: response.statusText || 'Request failed',
      details: {},
    })
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(disposition) ?? `jobcraft-artifact.${format === 'pdf' ? 'pdf' : 'md'}`,
  }
}

function filenameFromDisposition(value: string): string | null {
  const match = value.match(/filename="([^"]+)"/)
  return match?.[1] ?? null
}

export function getSuggestions(): Promise<{ suggestions: JobSuggestion[] }> {
  return apiRequest('/api/suggestions', {
    method: 'POST',
    schema: suggestResponseSchema,
  })
}

export function quickFit(jobUuid: string): Promise<QuickFit> {
  return apiRequest('/api/quickfit', {
    method: 'POST',
    body: { job_uuid: jobUuid },
    schema: quickFitSchema,
  })
}

export function getProfile(): Promise<Profile> {
  return apiRequest('/api/profile', { schema: profileSchema })
}

export function updateProfile(input: ProfileUpdate): Promise<Profile> {
  return apiRequest('/api/profile', {
    method: 'PUT',
    body: profileUpdateSchema.parse(input),
    schema: profileSchema,
  })
}

export function parseCv(cvText: string): Promise<Profile> {
  return apiRequest('/api/profile/parse', {
    method: 'POST',
    body: cvParseRequestSchema.parse({ cv_text: cvText }),
    schema: profileSchema,
  })
}

export function enrichQuestions(): Promise<EnrichQuestionsResult> {
  return apiRequest('/api/profile/enrich/questions', {
    method: 'POST',
    schema: enrichQuestionsResultSchema,
  })
}

export function enrichApply(answers: EnrichAnswer[]): Promise<EnrichApplyResponse> {
  return apiRequest('/api/profile/enrich/apply', {
    method: 'POST',
    body: enrichApplyRequestSchema.parse({ answers }),
    schema: enrichApplyResponseSchema,
  })
}

export function createSkill(input: SkillInput): Promise<Skill> {
  return apiRequest('/api/profile/skills', {
    method: 'POST',
    body: skillInputSchema.parse(input),
    schema: skillSchema,
  })
}

export function updateSkill(id: string, input: SkillUpdate): Promise<Skill> {
  return apiRequest(`/api/profile/skills/${id}`, {
    method: 'PUT',
    body: skillUpdateSchema.parse(input),
    schema: skillSchema,
  })
}

export function deleteSkill(id: string): Promise<null> {
  return apiRequest(`/api/profile/skills/${id}`, {
    method: 'DELETE',
    schema: z.null(),
  })
}

export function createExperience(input: ExperienceInput): Promise<Experience> {
  return apiRequest('/api/profile/experiences', {
    method: 'POST',
    body: experienceInputSchema.parse(input),
    schema: experienceSchema,
  })
}

export function updateExperience(id: string, input: ExperienceUpdate): Promise<Experience> {
  return apiRequest(`/api/profile/experiences/${id}`, {
    method: 'PUT',
    body: experienceUpdateSchema.parse(input),
    schema: experienceSchema,
  })
}

export function deleteExperience(id: string): Promise<null> {
  return apiRequest(`/api/profile/experiences/${id}`, {
    method: 'DELETE',
    schema: z.null(),
  })
}

export function createProject(input: ProjectInput): Promise<Project> {
  return apiRequest('/api/profile/projects', {
    method: 'POST',
    body: projectInputSchema.parse(input),
    schema: projectSchema,
  })
}

export function updateProject(id: string, input: ProjectUpdate): Promise<Project> {
  return apiRequest(`/api/profile/projects/${id}`, {
    method: 'PUT',
    body: projectUpdateSchema.parse(input),
    schema: projectSchema,
  })
}

export function deleteProject(id: string): Promise<null> {
  return apiRequest(`/api/profile/projects/${id}`, {
    method: 'DELETE',
    schema: z.null(),
  })
}

export function createEducation(input: EducationInput): Promise<Education> {
  return apiRequest('/api/profile/education', {
    method: 'POST',
    body: educationInputSchema.parse(input),
    schema: educationSchema,
  })
}

export function updateEducation(id: string, input: EducationUpdate): Promise<Education> {
  return apiRequest(`/api/profile/education/${id}`, {
    method: 'PUT',
    body: educationUpdateSchema.parse(input),
    schema: educationSchema,
  })
}

export function deleteEducation(id: string): Promise<null> {
  return apiRequest(`/api/profile/education/${id}`, {
    method: 'DELETE',
    schema: z.null(),
  })
}
