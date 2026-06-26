import { useQuery } from '@tanstack/react-query'
import { basicSearch, getHealth, getSettings } from './client'
import type { BasicSearchRequest } from './schemas'

export const queryKeys = {
  health: ['health'] as const,
  settings: ['settings'] as const,
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
