import { z } from 'zod'
import {
  apiErrorSchema,
  basicSearchRequestSchema,
  cvParseRequestSchema,
  experienceInputSchema,
  experienceSchema,
  experienceUpdateSchema,
  healthSchema,
  profileSchema,
  profileUpdateSchema,
  projectInputSchema,
  projectSchema,
  projectUpdateSchema,
  searchResponseSchema,
  settingsSchema,
  skillInputSchema,
  skillSchema,
  skillUpdateSchema,
  type ApiErrorPayload,
  type BasicSearchRequest,
  type Experience,
  type ExperienceInput,
  type ExperienceUpdate,
  type Health,
  type Profile,
  type ProfileUpdate,
  type Project,
  type ProjectInput,
  type ProjectUpdate,
  type SearchResponse,
  type Settings,
  type Skill,
  type SkillInput,
  type SkillUpdate,
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
