import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  advancedSearch,
  autocompleteSearch,
  basicSearch,
  createSearchPreset,
  createComms,
  createExperience,
  createProject,
  createSkill,
  createEducation,
  deleteApplication,
  deleteEducation,
  deleteExperience,
  deleteProject,
  deleteSearchPreset,
  deleteSkill,
  deleteComms,
  enrichApply,
  enrichQuestions,
  exportArtifact,
  generateArtifact,
  getArtifact,
  getHealth,
  getApplication,
  getApplicationBrief,
  getChecklist,
  listComms,
  getFit,
  getJobDetail,
  getProfile,
  getSettings,
  getSuggestions,
  listApplications,
  listArtifacts,
  listSearchPresets,
  parseCv,
  patchApplication,
  runFit,
  saveApplication,
  updateApplicationBrief,
  updateChecklist,
  updateEducation,
  updateExperience,
  updateProfile,
  updateProject,
  updateRequirementOverride,
  updateSkill,
} from './client'
import type {
  ApplicationBriefRequest,
  ApplicationPatch,
  CommsLogCreate,
  EducationInput,
  EducationUpdate,
  EnrichAnswer,
  GeneratedArtifact,
  GenerateRequest,
  GeneratableArtifactKind,
  BasicSearchRequest,
  SearchBody,
  SearchPresetCreate,
  ExperienceInput,
  ExperienceUpdate,
  Profile,
  ProfileUpdate,
  ProjectInput,
  ProjectUpdate,
  SkillInput,
  SkillUpdate,
  RequirementStatus,
  PackageChecklistRequest,
} from './schemas'

export const queryKeys = {
  health: ['health'] as const,
  settings: ['settings'] as const,
  profile: ['profile'] as const,
  applications: ['applications'] as const,
  application: (id: string) => ['applications', id] as const,
  brief: (id: string) => ['applications', id, 'brief'] as const,
  fit: (id: string) => ['applications', id, 'fit'] as const,
  checklist: (id: string) => ['applications', id, 'checklist'] as const,
  comms: (id: string) => ['applications', id, 'comms'] as const,
  artifacts: (id: string, kind?: GeneratableArtifactKind) => ['applications', id, 'artifacts', kind ?? 'all'] as const,
  artifact: (id: string) => ['artifacts', id] as const,
  presets: ['search', 'presets'] as const,
  autocomplete: (phrase: string) => ['search', 'autocomplete', phrase] as const,
  jobDetail: (uuid: string) => ['jobs', uuid] as const,
  basicSearch: (request: BasicSearchRequest) => ['search', 'basic', request] as const,
}

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
  })
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettings,
  })
}

export function useBasicSearchQuery(request: BasicSearchRequest, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.basicSearch(request),
    queryFn: () => basicSearch(request),
    enabled,
  })
}

export function useAutocompleteQuery(phrase: string) {
  return useQuery({
    queryKey: queryKeys.autocomplete(phrase),
    queryFn: () => autocompleteSearch(phrase),
    enabled: phrase.trim().length >= 2,
  })
}

export function useJobDetailQuery(uuid: string | null) {
  return useQuery({
    queryKey: queryKeys.jobDetail(uuid ?? ''),
    queryFn: () => getJobDetail(uuid ?? ''),
    enabled: Boolean(uuid),
  })
}

export function useSearchPresetsQuery() {
  return useQuery({
    queryKey: queryKeys.presets,
    queryFn: listSearchPresets,
  })
}

export function useBasicSearchMutation() {
  return useMutation({
    mutationFn: (request: BasicSearchRequest) => basicSearch(request),
  })
}

export function useAdvancedSearchMutation() {
  return useMutation({
    mutationFn: (body: SearchBody) => advancedSearch(body),
  })
}

export function useCreateSearchPresetMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SearchPresetCreate) => createSearchPreset(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presets })
    },
  })
}

export function useDeleteSearchPresetMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSearchPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presets })
    },
  })
}

export function useSaveApplicationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobUuid: string) => saveApplication(jobUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications })
    },
  })
}

export function useSuggestionsMutation() {
  return useMutation({
    mutationFn: getSuggestions,
  })
}

export function useSuggestionsQuery() {
  return useQuery({
    queryKey: ['suggestions'] as const,
    queryFn: getSuggestions,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useApplicationsQuery() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: listApplications,
  })
}

export function useApplicationQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.application(id ?? ''),
    queryFn: () => getApplication(id ?? ''),
    enabled: Boolean(id),
  })
}

export function usePatchApplicationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApplicationPatch }) => patchApplication(id, input),
    onSuccess: (application) => {
      queryClient.setQueryData(queryKeys.application(application.id), application)
      queryClient.invalidateQueries({ queryKey: queryKeys.applications })
    },
  })
}

export function useDeleteApplicationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications })
    },
  })
}

export function useApplicationBriefQuery(applicationId: string | null) {
  return useQuery({
    queryKey: queryKeys.brief(applicationId ?? ''),
    queryFn: () => getApplicationBrief(applicationId ?? ''),
    enabled: Boolean(applicationId),
  })
}

export function useUpdateApplicationBriefMutation(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplicationBriefRequest) => updateApplicationBrief(applicationId, input),
    onSuccess: (brief) => {
      queryClient.setQueryData(queryKeys.brief(applicationId), brief)
    },
  })
}

export function useFitQuery(applicationId: string | null) {
  return useQuery({
    queryKey: queryKeys.fit(applicationId ?? ''),
    queryFn: () => getFit(applicationId ?? ''),
    enabled: Boolean(applicationId),
    retry: false,
  })
}

export function useRunFitMutation(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => runFit(applicationId),
    onSuccess: (fit) => {
      queryClient.setQueryData(queryKeys.fit(applicationId), fit)
    },
  })
}

export function useUpdateRequirementOverrideMutation(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requirementId, userOverride }: { requirementId: string; userOverride: RequirementStatus | null }) =>
      updateRequirementOverride(applicationId, requirementId, userOverride),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fit(applicationId) })
    },
  })
}

export function useChecklistQuery(applicationId: string | null) {
  return useQuery({
    queryKey: queryKeys.checklist(applicationId ?? ''),
    queryFn: () => getChecklist(applicationId ?? ''),
    enabled: Boolean(applicationId),
  })
}

export function useUpdateChecklistMutation(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PackageChecklistRequest) => updateChecklist(applicationId, input),
    onSuccess: (checklist) => {
      queryClient.setQueryData(queryKeys.checklist(applicationId), checklist)
      queryClient.invalidateQueries({ queryKey: queryKeys.applications })
    },
  })
}

export function useCommsQuery(applicationId: string | null) {
  return useQuery({
    queryKey: queryKeys.comms(applicationId ?? ''),
    queryFn: () => listComms(applicationId ?? ''),
    enabled: Boolean(applicationId),
  })
}

export function useCreateCommsMutation(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CommsLogCreate) => createComms(applicationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comms(applicationId) })
    },
  })
}

export function useDeleteCommsMutation(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => deleteComms(applicationId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comms(applicationId) })
    },
  })
}

export function useArtifactsQuery(applicationId: string | null, kind?: GeneratableArtifactKind) {
  return useQuery({
    queryKey: queryKeys.artifacts(applicationId ?? '', kind),
    queryFn: () => listArtifacts(applicationId ?? '', kind),
    enabled: Boolean(applicationId),
  })
}

export function useArtifactQuery(artifactId: string | null) {
  return useQuery({
    queryKey: queryKeys.artifact(artifactId ?? ''),
    queryFn: () => getArtifact(artifactId ?? ''),
    enabled: Boolean(artifactId),
  })
}

export function useGenerateArtifactMutation(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateRequest) => generateArtifact(applicationId, input),
    onSuccess: (artifact) => {
      queryClient.setQueryData(queryKeys.artifact(artifact.id), artifact)
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts(applicationId, artifact.kind as GeneratableArtifactKind) })
      queryClient.invalidateQueries({ queryKey: queryKeys.artifacts(applicationId) })
    },
  })
}

export function useExportArtifactMutation() {
  return useMutation({
    mutationFn: ({ artifact, format }: { artifact: GeneratedArtifact; format: 'markdown' | 'pdf' }) =>
      exportArtifact(artifact.id, format),
  })
}

export function useProfileQuery() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: getProfile,
  })
}

export function useParseCvMutation() {
  return useProfileMutation<string>((cvText) => parseCv(cvText))
}

export function useEnrichQuestionsMutation() {
  return useMutation({
    mutationFn: enrichQuestions,
  })
}

export function useEnrichApplyMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (answers: EnrichAnswer[]) => enrichApply(answers),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.profile, result.profile)
    },
  })
}

export function useUpdateProfileMutation() {
  return useProfileMutation<ProfileUpdate>((input) => updateProfile(input))
}

export function useCreateSkillMutation() {
  return useInvalidatingMutation((input: SkillInput) => createSkill(input))
}

export function useUpdateSkillMutation() {
  return useInvalidatingMutation(({ id, input }: { id: string; input: SkillUpdate }) =>
    updateSkill(id, input),
  )
}

export function useDeleteSkillMutation() {
  return useInvalidatingMutation((id: string) => deleteSkill(id))
}

export function useCreateExperienceMutation() {
  return useInvalidatingMutation((input: ExperienceInput) => createExperience(input))
}

export function useUpdateExperienceMutation() {
  return useInvalidatingMutation(({ id, input }: { id: string; input: ExperienceUpdate }) =>
    updateExperience(id, input),
  )
}

export function useDeleteExperienceMutation() {
  return useInvalidatingMutation((id: string) => deleteExperience(id))
}

export function useCreateProjectMutation() {
  return useInvalidatingMutation((input: ProjectInput) => createProject(input))
}

export function useUpdateProjectMutation() {
  return useInvalidatingMutation(({ id, input }: { id: string; input: ProjectUpdate }) =>
    updateProject(id, input),
  )
}

export function useDeleteProjectMutation() {
  return useInvalidatingMutation((id: string) => deleteProject(id))
}

export function useCreateEducationMutation() {
  return useInvalidatingMutation((input: EducationInput) => createEducation(input))
}

export function useUpdateEducationMutation() {
  return useInvalidatingMutation(({ id, input }: { id: string; input: EducationUpdate }) =>
    updateEducation(id, input),
  )
}

export function useDeleteEducationMutation() {
  return useInvalidatingMutation((id: string) => deleteEducation(id))
}

function useProfileMutation<TInput>(mutationFn: (input: TInput) => Promise<Profile>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile, profile)
    },
  })
}

function useInvalidatingMutation<TInput, TOutput>(mutationFn: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile })
    },
  })
}
