import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ApiError,
  useBasicSearchMutation,
  useJobDetailQuery,
  useSaveApplicationMutation,
  useSuggestionsMutation,
  type BasicSearchRequest,
  type JobDetail,
  type JobSummary,
} from '../api'

type LocationOption = { key: string; label: string; lat: number; lon: number }

const locations: LocationOption[] = [
  { key: 'berlin', label: 'Berlin', lat: 52.52, lon: 13.405 },
  { key: 'munich', label: 'Munich', lat: 48.137, lon: 11.575 },
  { key: 'hamburg', label: 'Hamburg', lat: 53.551, lon: 9.994 },
  { key: 'cologne', label: 'Cologne', lat: 50.938, lon: 6.96 },
  { key: 'frankfurt', label: 'Frankfurt', lat: 50.11, lon: 8.682 },
]

const jobTypeOptions = [
  { value: 'OCCUPATION', label: 'Regular role' },
  { value: 'STUDENT_EMPLOYEE', label: 'Working student' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'APPRENTICESHIP', label: 'Apprenticeship' },
]

const employmentTypeOptions = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'MINI_JOB', label: 'Mini job' },
]

export function SearchPage() {
  const suggestions = useSuggestionsMutation()
  const search = useBasicSearchMutation()
  const save = useSaveApplicationMutation()

  const [phrase, setPhrase] = useState('')
  const [locationKey, setLocationKey] = useState('')
  const [radiusKm, setRadiusKm] = useState('30')
  const [jobTypes, setJobTypes] = useState<string[]>([])
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [selectedJobUuid, setSelectedJobUuid] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const detail = useJobDetailQuery(selectedJobUuid)

  // Lead with AI recommendations on first load.
  const askedRef = useRef(false)
  useEffect(() => {
    if (!askedRef.current) {
      askedRef.current = true
      suggestions.mutate()
    }
  }, [suggestions])

  function buildRequest(searchPhrase: string): BasicSearchRequest {
    const loc = locations.find((item) => item.key === locationKey)
    return {
      phrase: searchPhrase.trim() || undefined,
      location: loc ? { lat: loc.lat, lon: loc.lon, radius_km: Number(radiusKm) || 30 } : undefined,
      job_types: jobTypes,
      employment_types: employmentTypes,
      page: 1,
      size: 20,
    }
  }

  function runSearch(searchPhrase: string, role: string | null) {
    setActiveRole(role)
    setSelectedJobUuid(null)
    setSavedId(null)
    search.mutate(buildRequest(searchPhrase))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (phrase.trim().length === 0) return
    runSearch(phrase, null)
  }

  function explore(role: string, searchPhrase: string) {
    setPhrase(searchPhrase)
    runSearch(searchPhrase, role)
  }

  function selectJob(uuid: string) {
    setSelectedJobUuid(uuid)
    setSavedId(null)
  }

  function saveJob() {
    if (!selectedJobUuid) return
    save.mutate(selectedJobUuid, { onSuccess: (app) => setSavedId(app.id) })
  }

  const result = search.data
  const cards = suggestions.data?.suggestions ?? []
  const selectedSummary = result?.jobs.find((job) => job.uuid === selectedJobUuid) ?? null

  return (
    <section className="discover-layout" aria-labelledby="discover-title">
      <div className="section-heading">
        <p className="eyebrow">Discover</p>
        <h2 id="discover-title">Find your next role</h2>
        <p className="section-copy">
          Start from roles the assistant thinks fit you, explore the live market, and bookmark the
          jobs worth pursuing — they land on your Board.
        </p>
      </div>

      {/* ── Recommendations ─────────────────────────── */}
      <div className="page-section rec-section">
        <div className="card-heading">
          <div>
            <h3>Roles that fit you</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>Generated from your profile. Click one to explore real openings.</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => suggestions.mutate()} disabled={suggestions.isPending}>
            {suggestions.isPending ? 'Thinking…' : 'Refresh'}
          </button>
        </div>

        {suggestions.isPending ? <p className="muted">Looking at your profile…</p> : null}
        {suggestions.isError ? (
          <div className="notice notice-error">
            Couldn't generate recommendations right now. Add more to your profile or try refreshing.
          </div>
        ) : null}
        {!suggestions.isPending && cards.length === 0 && !suggestions.isError ? (
          <p className="muted">No recommendations yet — build your profile first, then refresh.</p>
        ) : null}

        <div className="rec-grid">
          {cards.map((card) => (
            <button
              key={card.role}
              type="button"
              className={activeRole === card.role ? 'rec-card rec-card-active' : 'rec-card'}
              onClick={() => explore(card.role, card.phrase)}
            >
              <strong>{card.role}</strong>
              {card.rationale ? <span className="rec-why">{card.rationale}</span> : null}
              {card.skills.length > 0 ? (
                <span className="rec-skills">
                  {card.skills.slice(0, 5).map((skill) => (
                    <span className="rec-skill" key={skill}>{skill}</span>
                  ))}
                </span>
              ) : null}
              <span className="rec-cta">Explore openings →</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Search bar ──────────────────────────────── */}
      <form className="page-section search-bar" onSubmit={submit}>
        <div className="search-bar-row">
          <label className="search-bar-phrase">
            Search roles or keywords
            <input value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="e.g. MLOps Engineer, Python, Berlin…" />
          </label>
          <label>
            Location
            <select value={locationKey} onChange={(event) => setLocationKey(event.target.value)}>
              <option value="">Anywhere</option>
              {locations.map((loc) => (
                <option key={loc.key} value={loc.key}>{loc.label}</option>
              ))}
            </select>
          </label>
          {locationKey ? (
            <label className="search-bar-radius">
              Radius km
              <input type="number" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)} />
            </label>
          ) : null}
          <button type="submit" disabled={search.isPending || phrase.trim().length === 0}>
            {search.isPending ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div className="search-bar-foot">
          <button type="button" className="link-toggle" onClick={() => setFiltersOpen((open) => !open)}>
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
        </div>
        {filtersOpen ? (
          <div className="search-filters">
            <ChipFilter label="Role type" options={jobTypeOptions} values={jobTypes} onChange={setJobTypes} />
            <ChipFilter label="Working time" options={employmentTypeOptions} values={employmentTypes} onChange={setEmploymentTypes} />
          </div>
        ) : null}
      </form>

      {/* ── Results ─────────────────────────────────── */}
      {search.isError ? <div className="notice notice-error">Search failed. Please try again.</div> : null}

      {result ? (
        <div className="results-grid">
          <div className="results-col">
            <div className="results-header">
              <h3>{activeRole ?? 'Results'}</h3>
              <span>{result.hits.toLocaleString()} matches</span>
            </div>
            {result.jobs.length === 0 ? <p className="muted">No openings matched. Try a broader phrase or remove filters.</p> : null}
            <div className="job-list">
              {result.jobs.map((job) => (
                <button
                  key={job.uuid}
                  type="button"
                  className={job.uuid === selectedJobUuid ? 'job-row job-row-active' : 'job-row'}
                  onClick={() => selectJob(job.uuid)}
                >
                  <strong>{job.title ?? 'Untitled role'}</strong>
                  <span>{[job.company, job.place].filter(Boolean).join(' · ') || '—'}</span>
                  <small>{job.employment_types.join(' / ') || '—'}</small>
                </button>
              ))}
            </div>
          </div>
          <JobDetailPanel
            summary={selectedSummary}
            detail={detail.data}
            loading={detail.isFetching}
            onSave={saveJob}
            saving={save.isPending}
            savedId={savedId}
            saveError={save.error}
          />
        </div>
      ) : (
        <p className="muted discover-hint">Pick a recommended role above, or search to see openings.</p>
      )}
    </section>
  )
}

function JobDetailPanel({
  summary,
  detail,
  loading,
  onSave,
  saving,
  savedId,
  saveError,
}: {
  summary: JobSummary | null
  detail: JobDetail | undefined
  loading: boolean
  onSave: () => void
  saving: boolean
  savedId: string | null
  saveError: Error | null
}) {
  if (!summary) {
    return (
      <aside className="job-detail-panel job-detail-empty">
        <p className="muted">Select an opening to read the full posting and bookmark it.</p>
      </aside>
    )
  }

  const title = detail?.text.title ?? summary.title ?? 'Untitled role'
  const company = detail?.companyCleaned ?? detail?.company ?? summary.company
  const place = detail?.addresses?.[0]?.place ?? summary.place

  return (
    <aside className="job-detail-panel">
      <div className="card-heading">
        <h3>{title}</h3>
        <button type="button" onClick={onSave} disabled={saving || Boolean(savedId)}>
          {saving ? 'Saving…' : savedId ? '✓ Bookmarked' : '☆ Bookmark'}
        </button>
      </div>
      <p className="muted">{[company, place].filter(Boolean).join(' · ')}</p>
      {savedId ? (
        <div className="notice enrich-result">
          Bookmarked to your Board. <Link to={`/workspace/${savedId}`}>Open workspace →</Link>
        </div>
      ) : null}
      {saveError ? <ErrorNotice error={saveError} /> : null}
      {detail?.link ? (
        <p><a href={detail.link} target="_blank" rel="noreferrer">Open original posting →</a></p>
      ) : null}
      {loading ? <p className="muted">Loading posting…</p> : null}
      <DetailList title="Tasks" items={detail?.text.tasks ?? []} />
      <DetailList title="Requirements" items={detail?.text.requirements ?? []} />
      <DetailList title="Benefits" items={detail?.text.benefits ?? []} />
      {detail?.text.fulltext ? <p className="job-fulltext">{detail.text.fulltext}</p> : null}
    </aside>
  )
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="detail-list">
      <h4>{title}</h4>
      <ul>
        {items.slice(0, 8).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function ChipFilter({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <div className="facet-group">
      <h4>{label}</h4>
      <div className="chip-row">
        {options.map((option) => {
          const active = values.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              className={active ? 'filter-chip filter-chip-active' : 'filter-chip'}
              onClick={() => onChange(active ? values.filter((v) => v !== option.value) : [...values, option.value])}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ErrorNotice({ error }: { error: Error }) {
  const message =
    error instanceof ApiError
      ? error.code === 'conflict'
        ? 'This job is already on your board.'
        : `${error.status} ${error.code}: ${error.message}`
      : error.message
  return <div className="notice notice-error" role="alert">{message}</div>
}
