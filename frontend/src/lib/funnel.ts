import type { Application, Profile } from '../api'

export const DEFAULT_GHOST_DAYS = 21

export function ghostThreshold(profile: Profile | undefined): number {
  const raw = profile?.preferences?.ghost_threshold_days
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_GHOST_DAYS
}

/** Gone quiet = applied, no movement, past the user's threshold. Client-computed so the
 *  threshold control is instant. days_since_applied still comes from the server clock. */
export function isGoneQuiet(application: Application, thresholdDays: number): boolean {
  return (
    application.status === 'APPLIED' &&
    application.days_since_applied !== null &&
    application.days_since_applied >= thresholdDays
  )
}

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function withinDays(iso: string, days: number): boolean {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000 <= days
}
