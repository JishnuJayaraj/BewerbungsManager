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

export const skillKindSchema = z.enum(['IT_SKILL', 'SOFT_SKILL', 'LANGUAGE', 'CERT'])
export const profileEntrySourceSchema = z.enum(['CV', 'MANUAL'])

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: skillKindSchema,
  level: z.string().nullable(),
  source: profileEntrySourceSchema,
})

export const skillInputSchema = z.object({
  name: z.string().min(1),
  kind: skillKindSchema,
  level: z.string().nullable().optional(),
  source: profileEntrySourceSchema.default('MANUAL'),
})

export const skillUpdateSchema = skillInputSchema.partial()

export const experienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  is_current: z.boolean(),
  summary: z.string().nullable(),
  bullets: z.array(z.string()),
  tech: z.array(z.string()),
})

export const experienceInputSchema = z.object({
  title: z.string().min(1),
  company: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  is_current: z.boolean().default(false),
  summary: z.string().nullable().optional(),
  bullets: z.array(z.string()).default([]),
  tech: z.array(z.string()).default([]),
})

export const experienceUpdateSchema = experienceInputSchema.partial()

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  summary: z.string().nullable(),
  tech: z.array(z.string()),
  links: z.array(z.string()),
})

export const projectInputSchema = z.object({
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  tech: z.array(z.string()).default([]),
  links: z.array(z.string()).default([]),
})

export const projectUpdateSchema = projectInputSchema.partial()

export const profileSchema = z.object({
  id: z.string(),
  full_name: z.string().nullable(),
  headline: z.string().nullable(),
  seniority: z.string().nullable(),
  years_exp: z.number().nullable(),
  summary: z.string().nullable(),
  locations: z.array(z.record(z.string(), z.unknown())),
  preferences: z.record(z.string(), z.unknown()),
  brief_defaults: z.record(z.string(), z.unknown()),
  skills: z.array(skillSchema),
  experiences: z.array(experienceSchema),
  projects: z.array(projectSchema),
  parse_warning: z.string().nullable().optional(),
})

export const profileUpdateSchema = z.object({
  full_name: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  seniority: z.string().nullable().optional(),
  years_exp: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
  locations: z.array(z.record(z.string(), z.unknown())).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  brief_defaults: z.record(z.string(), z.unknown()).optional(),
})

export const cvParseRequestSchema = z.object({
  cv_text: z.string().min(1),
})

export type ApiErrorPayload = z.infer<typeof apiErrorSchema>['error']
export type Health = z.infer<typeof healthSchema>
export type Settings = z.infer<typeof settingsSchema>
export type BasicSearchRequest = z.infer<typeof basicSearchRequestSchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>
export type JobSummary = z.infer<typeof jobSummarySchema>
export type Profile = z.infer<typeof profileSchema>
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>
export type Skill = z.infer<typeof skillSchema>
export type SkillInput = z.infer<typeof skillInputSchema>
export type SkillUpdate = z.infer<typeof skillUpdateSchema>
export type Experience = z.infer<typeof experienceSchema>
export type ExperienceInput = z.infer<typeof experienceInputSchema>
export type ExperienceUpdate = z.infer<typeof experienceUpdateSchema>
export type Project = z.infer<typeof projectSchema>
export type ProjectInput = z.infer<typeof projectInputSchema>
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>
export type SkillKind = z.infer<typeof skillKindSchema>
export type ProfileEntrySource = z.infer<typeof profileEntrySourceSchema>
