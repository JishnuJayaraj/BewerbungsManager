import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  basicSearch,
  createExperience,
  createProject,
  createSkill,
  deleteExperience,
  deleteProject,
  deleteSkill,
  getHealth,
  getProfile,
  getSettings,
  parseCv,
  updateExperience,
  updateProfile,
  updateProject,
  updateSkill,
} from './client'
import type {
  BasicSearchRequest,
  ExperienceInput,
  ExperienceUpdate,
  Profile,
  ProfileUpdate,
  ProjectInput,
  ProjectUpdate,
  SkillInput,
  SkillUpdate,
} from './schemas'

export const queryKeys = {
  health: ['health'] as const,
  settings: ['settings'] as const,
  profile: ['profile'] as const,
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

export function useProfileQuery() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: getProfile,
  })
}

export function useParseCvMutation() {
  return useProfileMutation<string>((cvText) => parseCv(cvText))
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
