import { z } from 'zod'
import {
  apiErrorSchema,
  basicSearchRequestSchema,
  healthSchema,
  searchResponseSchema,
  settingsSchema,
  type ApiErrorPayload,
  type BasicSearchRequest,
  type Health,
  type SearchResponse,
  type Settings,
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
