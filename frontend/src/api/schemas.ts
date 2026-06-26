import { z } from 'zod'

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).default({}),
  }),
})

export const healthSchema = z.object({
  status: z.literal('ok'),
})

export const settingsSchema = z.object({
  llm_provider: z.string(),
  single_user: z.boolean(),
  gdpr_notice: z.string(),
})

export const locationFilterSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  radius_km: z.number().positive(),
})

export const basicSearchRequestSchema = z.object({
  phrase: z.string().optional(),
  location: locationFilterSchema.optional(),
  job_types: z.array(z.string()).default([]),
  employment_types: z.array(z.string()).default([]),
  page: z.number().int().positive().default(1),
  size: z.number().int().positive().max(100).default(20),
})

export const jobSummarySchema = z.object({
  uuid: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  place: z.string().nullable(),
  employment_types: z.array(z.string()),
  job_types: z.array(z.string()),
  date_from: z.string().nullable(),
  score: z.number().nullable(),
  highlights: z.record(z.string(), z.unknown()).default({}),
})

export const searchResponseSchema = z.object({
  hits: z.number(),
  page: z.number(),
  jobs: z.array(jobSummarySchema),
  aggregations: z.record(z.string(), z.unknown()).default({}),
  deduped: z.number(),
})

export type ApiErrorPayload = z.infer<typeof apiErrorSchema>['error']
export type Health = z.infer<typeof healthSchema>
export type Settings = z.infer<typeof settingsSchema>
export type BasicSearchRequest = z.infer<typeof basicSearchRequestSchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>
export type JobSummary = z.infer<typeof jobSummarySchema>
