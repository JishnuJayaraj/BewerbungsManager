import type { Profile } from '../api'

export type ProfileGap = {
  key: string
  label: string
  anchor: string // element id to scroll to
  ai?: boolean // suggests the Enrich-with-AI flow
}

export type ProfileStrength = {
  pct: number
  done: number
  total: number
  gaps: ProfileGap[]
}

export function profileStrength(profile: Profile | undefined): ProfileStrength {
  if (!profile) return { pct: 0, done: 0, total: 1, gaps: [] }

  const skills = profile.skills.filter((s) => s.kind !== 'LANGUAGE' && s.kind !== 'CERT')
  const languages = profile.skills.filter((s) => s.kind === 'LANGUAGE')
  const targetRoles = Array.isArray(profile.preferences?.target_roles) ? (profile.preferences.target_roles as unknown[]) : []
  const expMissingBullets = profile.experiences.find((e) => e.bullets.length === 0)

  const checks: Array<{ key: string; ok: boolean; gap: ProfileGap }> = [
    { key: 'name', ok: Boolean(profile.full_name), gap: { key: 'name', label: 'Add your name & headline', anchor: 'identity' } },
    { key: 'summary', ok: Boolean(profile.summary && profile.summary.length > 40), gap: { key: 'summary', label: 'Write a professional summary', anchor: 'identity' } },
    { key: 'seniority', ok: Boolean(profile.seniority), gap: { key: 'seniority', label: 'Set your seniority & years', anchor: 'identity' } },
    { key: 'skills', ok: skills.length >= 5, gap: { key: 'skills', label: 'Add more skills (aim for 5+)', anchor: 'skills' } },
    { key: 'languages', ok: languages.length > 0, gap: { key: 'languages', label: 'Add your language levels (esp. German)', anchor: 'languages' } },
    { key: 'experience', ok: profile.experiences.length > 0, gap: { key: 'experience', label: 'Add work experience', anchor: 'experience' } },
    { key: 'bullets', ok: !expMissingBullets, gap: { key: 'bullets', label: expMissingBullets ? `Add achievements to "${expMissingBullets.title}"` : 'Add achievements', anchor: 'experience' } },
    { key: 'education', ok: profile.education.length > 0, gap: { key: 'education', label: 'Add your education', anchor: 'education' } },
    { key: 'roles', ok: targetRoles.length > 0, gap: { key: 'roles', label: 'Tell the assistant your target roles', anchor: 'identity', ai: true } },
    { key: 'links', ok: profile.links.length > 0, gap: { key: 'links', label: 'Add a GitHub / LinkedIn / portfolio link', anchor: 'links' } },
  ]

  const done = checks.filter((c) => c.ok).length
  const total = checks.length
  return {
    pct: Math.round((done / total) * 100),
    done,
    total,
    gaps: checks.filter((c) => !c.ok).map((c) => c.gap),
  }
}
