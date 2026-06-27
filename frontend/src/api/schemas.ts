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
  places: z.array(z.string()).default([]),
  job_types: z.array(z.string()).default([]),
  employment_types: z.array(z.string()).default([]),
  contract_types: z.array(z.string()).default([]),
  posted_within_days: z.number().int().positive().max(365).nullable().optional(),
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

export const searchBodySchema = z.record(z.string(), z.unknown())

export const autocompleteSuggestionSchema = z.object({
  uuid: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
})

export const searchPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  query_json: searchBodySchema,
  created_at: z.string(),
})

export const searchPresetListSchema = z.object({
  items: z.array(searchPresetSchema),
  page: z.number(),
  total: z.number(),
})

export const searchPresetCreateSchema = z.object({
  name: z.string().min(1),
  query_json: searchBodySchema,
})

export const hr4uAddressSchema = z
  .object({
    place: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    county: z.string().nullable().optional(),
    zipCode: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    streetNumber: z.string().nullable().optional(),
  })
  .passthrough()

export const hr4uCounterpartSchema = z
  .object({
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  })
  .passthrough()

export const hr4uTextSchema = z
  .object({
    title: z.string().nullable().optional(),
    fulltext: z.string().nullable().optional(),
    tasks: z.array(z.string()).default([]),
    requirements: z.array(z.string()).default([]),
    benefits: z.array(z.string()).default([]),
  })
  .passthrough()

export const hr4uClassificationsSchema = z
  .object({
    companyType: z.string().nullable().optional(),
    contractTypes: z.array(z.string()).default([]),
    employmentTypes: z.array(z.string()).default([]),
    jobTypes: z.array(z.string()).default([]),
    occupationAreas: z.array(z.string()).default([]),
  })
  .passthrough()

export const jobDetailSchema = z
  .object({
    uuid: z.string(),
    link: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    companyCleaned: z.string().nullable().optional(),
    text: hr4uTextSchema,
    addresses: z.array(hr4uAddressSchema).default([]),
    counterpart: hr4uCounterpartSchema.nullable().optional(),
    classifications: hr4uClassificationsSchema,
  })
  .passthrough()

export const applicationStatusSchema = z.enum(['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED', 'CLOSED'])

export const applicationSchema = z.object({
  id: z.string(),
  job_uuid: z.string(),
  job_snapshot: z.record(z.string(), z.unknown()),
  job_title: z.string(),
  company: z.string().nullable(),
  status: applicationStatusSchema,
  board_order: z.number(),
  contact: z.record(z.string(), z.unknown()),
  next_action: z.string().nullable(),
  followup_date: z.string().nullable(),
  needs_followup: z.boolean(),
  applied_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  days_since_applied: z.number().nullable().default(null),
  gone_quiet: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

export const applicationListSchema = z.object({
  items: z.array(applicationSchema),
  page: z.number(),
  total: z.number(),
})

export const applicationSaveSchema = z.object({
  job_uuid: z.string().min(1),
})

export const applicationPatchSchema = z.object({
  status: applicationStatusSchema.optional(),
  board_order: z.number().optional(),
  next_action: z.string().nullable().optional(),
  followup_date: z.string().nullable().optional(),
  applied_at: z.string().nullable().optional(),
  needs_followup: z.boolean().optional(),
  contact: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const briefLanguageSchema = z.enum(['DE', 'EN'])

export const applicationBriefSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  target_angle: z.string().nullable(),
  emphasize: z.array(z.string()),
  avoid: z.string().nullable(),
  tone: z.string().nullable(),
  language: briefLanguageSchema,
  company_motivation: z.string().nullable(),
  user_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const applicationBriefRequestSchema = z.object({
  target_angle: z.string().nullable().optional(),
  emphasize: z.array(z.string()).nullable().optional(),
  avoid: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  language: briefLanguageSchema.nullable().optional(),
  company_motivation: z.string().nullable().optional(),
  user_notes: z.string().nullable().optional(),
})

export const requirementStatusSchema = z.enum(['HAVE', 'PARTIAL', 'MISSING'])

export const evidencePointSchema = z.object({
  point: z.string(),
  evidence_ref: z.string().nullable().optional(),
})

export const unknownPointSchema = z.object({
  point: z.string(),
})

export const riskPointSchema = z.object({
  risk: z.string(),
  honest_framing: z.string(),
})

export const fitAnalysisSchema = z.object({
  summary: z.string(),
  strong_matches: z.array(evidencePointSchema).default([]),
  weak_matches: z.array(evidencePointSchema).default([]),
  unknowns: z.array(unknownPointSchema).default([]),
  suggested_angle: z.string().nullable().optional(),
  risks_to_address: z.array(riskPointSchema).default([]),
  do_not_claim: z.array(z.string()).default([]),
})

export const requirementCheckSchema = z.object({
  id: z.string(),
  requirement: z.string(),
  status: requirementStatusSchema,
  evidence: z.array(z.string()),
  user_override: requirementStatusSchema.nullable(),
})

export const fitResponseSchema = z.object({
  artifact_id: z.string(),
  fit: fitAnalysisSchema,
  requirements: z.array(requirementCheckSchema),
})

export const requirementOverrideRequestSchema = z.object({
  user_override: requirementStatusSchema.nullable(),
})

export const artifactKindSchema = z.enum([
  'COVER_LETTER',
  'CV_BULLET_SUGGESTIONS',
  'FIT_ANALYSIS',
  'PORTAL_ANSWER',
  'ANSWER_DRAFT',
])

export const generatableArtifactKindSchema = z.enum([
  'COVER_LETTER',
  'CV_BULLET_SUGGESTIONS',
  'PORTAL_ANSWER',
])

export const citationStatusSchema = z.enum(['SUPPORTED', 'UNSUPPORTED'])

export const verifiedCitationSchema = z.object({
  claim: z.string(),
  evidence_ref: z.string().nullable(),
  status: citationStatusSchema,
})

export const generatedArtifactSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  kind: artifactKindSchema,
  content: z.unknown(),
  citations: z.array(verifiedCitationSchema),
  has_unsupported: z.boolean(),
  model_used: z.string().nullable(),
  is_current: z.boolean(),
  created_at: z.string(),
})

export const generatedArtifactListSchema = z.object({
  items: z.array(generatedArtifactSchema),
})

export const generateRequestSchema = z.object({
  kind: generatableArtifactKindSchema,
  instruction: z.string().nullable().optional(),
  portal_question: z.string().nullable().optional(),
})

export const coverLetterContentSchema = z.object({
  language: briefLanguageSchema,
  format: z.enum(['anschreiben', 'plain']),
  subject: z.string().nullable().optional(),
  body: z.string(),
  claims: z.array(z.object({ claim: z.string(), evidence_ref: z.string().nullable().optional() })).default([]),
})

export const cvBulletSuggestionSchema = z.object({
  experience_ref: z.string(),
  original: z.string().nullable().optional(),
  suggested: z.string(),
  reason: z.string(),
  evidence_ref: z.string().nullable().optional(),
})

export const cvBulletSuggestionsContentSchema = z.object({
  suggestions: z.array(cvBulletSuggestionSchema).default([]),
  emphasize: z.array(z.string()).default([]),
  do_not_pretend: z.array(z.string()).default([]),
})

export const portalAnswerContentSchema = z.object({
  question: z.string(),
  language: briefLanguageSchema,
  answer: z.string(),
  claims: z.array(z.object({ claim: z.string(), evidence_ref: z.string().nullable().optional() })).default([]),
})

export const workPermitStatusSchema = z.enum([
  'NOT_RELEVANT',
  'EU_CITIZEN',
  'HAVE_PERMIT',
  'NEED_SPONSORSHIP',
  'UNKNOWN',
])

export const packageChecklistItemsSchema = z.object({
  cv_reviewed: z.boolean(),
  cover_letter: z.boolean(),
  requirements_checked: z.boolean(),
  salary_set: z.boolean(),
  start_date_set: z.boolean(),
  language_ok: z.boolean(),
  work_permit_ok: z.boolean(),
  certificates: z.boolean(),
  portal_answers: z.boolean(),
  submitted: z.boolean(),
  followup_set: z.boolean(),
})

export const packageChecklistSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  salary_expectation: z.string().nullable(),
  earliest_start_date: z.string().nullable(),
  language_level_required: z.string().nullable(),
  language_level_user: z.string().nullable(),
  work_permit_status: workPermitStatusSchema,
  certificates_ready: z.boolean(),
  cover_letter_required: z.boolean(),
  items: packageChecklistItemsSchema,
  notes: z.string().nullable(),
})

export const packageChecklistRequestSchema = packageChecklistSchema.omit({
  id: true,
  application_id: true,
})

export const commsKindSchema = z.enum(['EMAIL', 'CALL', 'NOTE', 'EVENT'])
export const commsDirectionSchema = z.enum(['INBOUND', 'OUTBOUND', 'NONE'])

export const commsLogSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  kind: commsKindSchema,
  occurred_at: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  direction: commsDirectionSchema,
  created_at: z.string(),
})

export const commsLogListSchema = z.object({
  items: z.array(commsLogSchema),
  page: z.number(),
  total: z.number(),
})

export const commsLogCreateSchema = z.object({
  kind: commsKindSchema,
  occurred_at: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  direction: commsDirectionSchema.default('NONE'),
})

export const jobSuggestionSchema = z.object({
  role: z.string(),
  rationale: z.string().default(''),
  phrase: z.string(),
  skills: z.array(z.string()).default([]),
})

export const suggestResponseSchema = z.object({
  suggestions: z.array(jobSuggestionSchema),
})

export const quickFitSchema = z.object({
  verdict: z.enum(['STRONG', 'STRETCH', 'WEAK']),
  headline: z.string().default(''),
  top_gaps: z.array(z.string()).default([]),
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

export const educationSchema = z.object({
  id: z.string(),
  degree: z.string(),
  institution: z.string().nullable(),
  field_of_study: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  grade: z.string().nullable(),
  summary: z.string().nullable(),
})

export const educationInputSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().nullable().optional(),
  field_of_study: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
})

export const educationUpdateSchema = educationInputSchema.partial()

export const profileLinkSchema = z.object({
  label: z.string().optional(),
  url: z.string().optional(),
})

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
  links: z.array(z.record(z.string(), z.unknown())).default([]),
  skills: z.array(skillSchema),
  experiences: z.array(experienceSchema),
  projects: z.array(projectSchema),
  education: z.array(educationSchema).default([]),
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
  links: z.array(z.record(z.string(), z.unknown())).optional(),
})

export const cvParseRequestSchema = z.object({
  cv_text: z.string().min(1),
})

export const enrichQuestionSchema = z.object({
  key: z.string(),
  question: z.string(),
  purpose: z.string().default(''),
  field: z.enum(['summary', 'seniority', 'years_exp', 'target_roles', 'skills', 'impact', 'language', 'other']),
})

export const enrichQuestionsResultSchema = z.object({
  questions: z.array(enrichQuestionSchema).default([]),
})

export const enrichAnswerSchema = z.object({
  key: z.string(),
  question: z.string(),
  answer: z.string().min(1),
})

export const enrichApplyRequestSchema = z.object({
  answers: z.array(enrichAnswerSchema).min(1),
})

export const enrichApplyResponseSchema = z.object({
  profile: profileSchema,
  changes: z.array(z.string()).default([]),
  added_skills: z.array(z.string()).default([]),
})

export const improveResultSchema = z.object({
  summary: z.string().nullable().default(null),
  bullets: z.array(z.string()).default([]),
  note: z.string().default(''),
})

export type ApiErrorPayload = z.infer<typeof apiErrorSchema>['error']
export type Health = z.infer<typeof healthSchema>
export type Settings = z.infer<typeof settingsSchema>
export type BasicSearchRequest = z.infer<typeof basicSearchRequestSchema>
export type SearchBody = z.infer<typeof searchBodySchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>
export type JobSummary = z.infer<typeof jobSummarySchema>
export type AutocompleteSuggestion = z.infer<typeof autocompleteSuggestionSchema>
export type SearchPreset = z.infer<typeof searchPresetSchema>
export type SearchPresetCreate = z.infer<typeof searchPresetCreateSchema>
export type SearchPresetList = z.infer<typeof searchPresetListSchema>
export type JobDetail = z.infer<typeof jobDetailSchema>
export type Application = z.infer<typeof applicationSchema>
export type ApplicationList = z.infer<typeof applicationListSchema>
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>
export type ApplicationPatch = z.infer<typeof applicationPatchSchema>
export type ApplicationBrief = z.infer<typeof applicationBriefSchema>
export type ApplicationBriefRequest = z.infer<typeof applicationBriefRequestSchema>
export type BriefLanguage = z.infer<typeof briefLanguageSchema>
export type FitResponse = z.infer<typeof fitResponseSchema>
export type FitAnalysis = z.infer<typeof fitAnalysisSchema>
export type RequirementCheck = z.infer<typeof requirementCheckSchema>
export type RequirementStatus = z.infer<typeof requirementStatusSchema>
export type ArtifactKind = z.infer<typeof artifactKindSchema>
export type GeneratableArtifactKind = z.infer<typeof generatableArtifactKindSchema>
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>
export type GeneratedArtifactList = z.infer<typeof generatedArtifactListSchema>
export type GenerateRequest = z.infer<typeof generateRequestSchema>
export type VerifiedCitation = z.infer<typeof verifiedCitationSchema>
export type CoverLetterContent = z.infer<typeof coverLetterContentSchema>
export type CvBulletSuggestionsContent = z.infer<typeof cvBulletSuggestionsContentSchema>
export type PortalAnswerContent = z.infer<typeof portalAnswerContentSchema>
export type PackageChecklist = z.infer<typeof packageChecklistSchema>
export type PackageChecklistRequest = z.infer<typeof packageChecklistRequestSchema>
export type PackageChecklistItems = z.infer<typeof packageChecklistItemsSchema>
export type WorkPermitStatus = z.infer<typeof workPermitStatusSchema>
export type CommsLogEntry = z.infer<typeof commsLogSchema>
export type CommsLogCreate = z.infer<typeof commsLogCreateSchema>
export type CommsKind = z.infer<typeof commsKindSchema>
export type CommsDirection = z.infer<typeof commsDirectionSchema>
export type JobSuggestion = z.infer<typeof jobSuggestionSchema>
export type SuggestResponse = z.infer<typeof suggestResponseSchema>
export type QuickFit = z.infer<typeof quickFitSchema>
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
export type Education = z.infer<typeof educationSchema>
export type EducationInput = z.infer<typeof educationInputSchema>
export type EducationUpdate = z.infer<typeof educationUpdateSchema>
export type SkillKind = z.infer<typeof skillKindSchema>
export type ProfileEntrySource = z.infer<typeof profileEntrySourceSchema>
export type EnrichQuestion = z.infer<typeof enrichQuestionSchema>
export type EnrichQuestionsResult = z.infer<typeof enrichQuestionsResultSchema>
export type EnrichAnswer = z.infer<typeof enrichAnswerSchema>
export type EnrichApplyResponse = z.infer<typeof enrichApplyResponseSchema>
export type ImproveResult = z.infer<typeof improveResultSchema>
