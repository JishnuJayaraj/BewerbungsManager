import { Link } from 'react-router'
import { useApplicationsQuery, useProfileQuery, type Application } from '../api'

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function withinDays(iso: string, days: number): boolean {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000 <= days
}

export function HomePage() {
  const profile = useProfileQuery()
  const applications = useApplicationsQuery()

  const skills = profile.data?.skills.length ?? 0
  const apps = applications.data?.items ?? []

  // ── "Needs you" buckets ───────────────────────────
  const followupsDue = apps
    .filter((a) => a.is_active && a.followup_date && daysUntil(a.followup_date) <= 2)
    .sort((a, b) => daysUntil(a.followup_date!) - daysUntil(b.followup_date!))
  const goneQuiet = apps.filter((a) => a.gone_quiet)
  const interviews = apps.filter((a) => a.status === 'INTERVIEW' || a.status === 'OFFER')
  const drafts = apps.filter((a) => a.status === 'SAVED')

  const focusCount = followupsDue.length + goneQuiet.length + interviews.length

  // ── This-week momentum ────────────────────────────
  const appliedThisWeek = apps.filter((a) => a.applied_at && withinDays(a.applied_at, 7)).length
  const activeTotal = apps.filter((a) => a.is_active).length
  const interviewing = interviews.length

  // ── First-run journey ─────────────────────────────
  const step1 = skills > 0
  const step2 = apps.length > 0
  const step3 = apps.some((a) => a.status !== 'SAVED')
  const showJourney = !(step1 && step2 && step3)

  return (
    <section className="home-layout" aria-labelledby="home-title">
      <div className="home-hero">
        <p className="eyebrow">JobCraft</p>
        <h2 id="home-title">{focusCount > 0 ? 'Here’s what needs you' : 'Craft your next application'}</h2>
        <p className="section-copy">
          Job hunting in Germany is a numbers game with a few threads that really matter. This is
          where those threads live — so nothing good goes cold in the noise.
        </p>
      </div>

      {/* ── Momentum ──────────────────────────────── */}
      {apps.length > 0 ? (
        <div className="momentum-row">
          <Stat label="Applied this week" value={appliedThisWeek} />
          <Stat label="Active threads" value={activeTotal} to="/board" />
          <Stat label="Interviewing" value={interviewing} to="/board" />
        </div>
      ) : null}

      {/* ── Needs you this week ───────────────────── */}
      {focusCount > 0 ? (
        <div className="focus-stack">
          <FocusGroup
            tone="urgent"
            title="Gone quiet — follow up or let go"
            empty=""
            items={goneQuiet}
            render={(a) => `Applied ${a.days_since_applied}d ago, no reply`}
          />
          <FocusGroup
            tone="due"
            title="Follow-ups due"
            empty=""
            items={followupsDue}
            render={(a) => followupLabel(a)}
          />
          <FocusGroup
            tone="good"
            title="Live conversations"
            empty=""
            items={interviews}
            render={(a) => (a.status === 'OFFER' ? 'Offer stage 🎉' : 'Interviewing')}
          />
        </div>
      ) : apps.length > 0 ? (
        <div className="notice focus-clear">
          ✓ Nothing urgent right now. {drafts.length > 0 ? (
            <>You have {drafts.length} saved {drafts.length === 1 ? 'role' : 'roles'} ready to apply to — <Link to="/board">open your board →</Link></>
          ) : (
            <>Keep the funnel full — <Link to="/search">discover more roles →</Link></>
          )}
        </div>
      ) : null}

      {/* ── First-run journey ─────────────────────── */}
      {showJourney ? (
        <ol className="journey">
          <JourneyStep done={step1} index={1} active={!step1} title="Build your profile"
            desc="Paste your CV, then enrich it with a few targeted questions." to="/profile"
            cta={step1 ? 'Refine profile' : 'Build profile'} />
          <JourneyStep done={step2} index={2} active={step1 && !step2} title="Find roles worth pursuing"
            desc="Let the assistant suggest roles, then bookmark the jobs you want." to="/search"
            cta={step2 ? 'Search more' : 'Start searching'} />
          <JourneyStep done={step3} index={3} active={step1 && step2 && !step3} title="Craft & track each application"
            desc="Check your fit, generate tailored materials, and track the next action." to="/board"
            cta="Open board" />
        </ol>
      ) : null}

      {/* ── Saved ready to apply ──────────────────── */}
      {drafts.length > 0 && focusCount > 0 ? (
        <div className="profile-card profile-card-wide">
          <div className="card-heading">
            <h3>Ready to apply ({drafts.length})</h3>
            <Link className="cta-link cta-link-quiet" to="/board">View board</Link>
          </div>
          <div className="home-recent">
            {drafts.slice(0, 6).map((a) => (
              <Link key={a.id} className="workspace-list-item" to={`/workspace/${a.id}`}>
                <strong>{a.job_title || 'Untitled role'}</strong>
                <span>{a.company ?? '—'}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function followupLabel(a: Application): string {
  const d = daysUntil(a.followup_date!)
  if (d < 0) return `Overdue by ${Math.abs(d)}d`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due in ${d}d`
}

function FocusGroup({
  tone,
  title,
  items,
  render,
}: {
  tone: 'urgent' | 'due' | 'good'
  title: string
  empty: string
  items: Application[]
  render: (a: Application) => string
}) {
  if (items.length === 0) return null
  return (
    <div className={`focus-group focus-${tone}`}>
      <div className="focus-group-head">
        <h3>{title}</h3>
        <span className="focus-count">{items.length}</span>
      </div>
      <div className="focus-items">
        {items.map((a) => (
          <Link key={a.id} className="focus-item" to={`/workspace/${a.id}`}>
            <div>
              <strong>{a.job_title || 'Untitled role'}</strong>
              <span>{a.company ?? '—'}</span>
            </div>
            <span className="focus-meta">{render(a)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function JourneyStep({
  done,
  active,
  index,
  title,
  desc,
  to,
  cta,
}: {
  done: boolean
  active: boolean
  index: number
  title: string
  desc: string
  to: string
  cta: string
}) {
  const state = done ? 'done' : active ? 'active' : 'todo'
  return (
    <li className={`journey-step journey-${state}`}>
      <span className="journey-index">{done ? '✓' : index}</span>
      <div className="journey-body">
        <h3>{title}</h3>
        <p className="muted">{desc}</p>
      </div>
      <Link className={done ? 'cta-link cta-link-quiet' : 'cta-link'} to={to}>{cta}</Link>
    </li>
  )
}

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const inner = (
    <>
      <span className="home-stat-value">{value}</span>
      <span className="home-stat-label">{label}</span>
    </>
  )
  if (to) return <Link className="home-stat" to={to}>{inner}</Link>
  return <div className="home-stat">{inner}</div>
}
