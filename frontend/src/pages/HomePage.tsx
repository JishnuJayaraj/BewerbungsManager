import { Link } from 'react-router'
import { useApplicationsQuery, useProfileQuery, type Application } from '../api'

const STATUS_LABELS: Record<Application['status'], string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
}

export function HomePage() {
  const profile = useProfileQuery()
  const applications = useApplicationsQuery()

  const skills = profile.data?.skills.length ?? 0
  const apps = applications.data?.items ?? []
  const inProgress = apps.filter((a) => a.status !== 'SAVED' && a.status !== 'CLOSED' && a.status !== 'REJECTED')

  const step1Done = skills > 0
  const step2Done = apps.length > 0
  const step3Done = apps.some((a) => a.status !== 'SAVED')

  const steps = [
    {
      done: step1Done,
      title: 'Build your profile',
      desc: 'Paste your CV, let the AI parse it, then enrich it with a few targeted questions.',
      to: '/profile',
      cta: step1Done ? 'Refine profile' : 'Build profile',
    },
    {
      done: step2Done,
      title: 'Find roles worth pursuing',
      desc: 'Search the live German job market, filter, and save the ones you want to chase.',
      to: '/search',
      cta: step2Done ? 'Search more' : 'Start searching',
    },
    {
      done: step3Done,
      title: 'Craft & track each application',
      desc: 'Write a brief, run a fit check, generate tailored materials, and track the next action.',
      to: '/board',
      cta: step3Done ? 'Open board' : 'Open board',
    },
  ]
  const activeIndex = steps.findIndex((s) => !s.done)

  return (
    <section className="home-layout" aria-labelledby="home-title">
      <div className="home-hero">
        <p className="eyebrow">JobCraft</p>
        <h2 id="home-title">Craft your next application</h2>
        <p className="section-copy">
          Build your profile once, find roles worth pursuing, and turn each into a tailored,
          honest application package — without losing track of who said what and when.
        </p>
      </div>

      <ol className="journey">
        {steps.map((step, index) => {
          const state = step.done ? 'done' : index === activeIndex ? 'active' : 'todo'
          return (
            <li key={step.title} className={`journey-step journey-${state}`}>
              <span className="journey-index">{step.done ? '✓' : index + 1}</span>
              <div className="journey-body">
                <h3>{step.title}</h3>
                <p className="muted">{step.desc}</p>
              </div>
              <Link className={step.done ? 'cta-link cta-link-quiet' : 'cta-link'} to={step.to}>
                {step.cta}
              </Link>
            </li>
          )
        })}
      </ol>

      <div className="home-stats">
        <Stat label="Skills" value={skills} to="/profile" />
        <Stat label="Saved roles" value={apps.length} to="/board" />
        <Stat label="In progress" value={inProgress.length} to="/board" />
      </div>

      {apps.length > 0 ? (
        <div className="profile-card profile-card-wide">
          <div className="card-heading">
            <h3>Recent applications</h3>
            <Link className="cta-link cta-link-quiet" to="/board">
              View board
            </Link>
          </div>
          <div className="home-recent">
            {apps.slice(0, 4).map((app) => (
              <Link key={app.id} className="workspace-list-item" to={`/workspace/${app.id}`}>
                <strong>{app.job_title || 'Untitled role'}</strong>
                <span>{app.company ?? '—'}</span>
                <span className="status-pill">{STATUS_LABELS[app.status]}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link className="home-stat" to={to}>
      <span className="home-stat-value">{value}</span>
      <span className="home-stat-label">{label}</span>
    </Link>
  )
}
