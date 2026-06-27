import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ApiError,
  useBasicSearchMutation,
  useCreateSearchPresetMutation,
  useDeleteSearchPresetMutation,
  useJobDetailQuery,
  useQuickFitMutation,
  useSaveApplicationMutation,
  useSearchPresetsQuery,
  useSuggestionsQuery,
  type BasicSearchRequest,
  type JobDetail,
  type JobSummary,
} from '../api'

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

const contractTypeOptions = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'TEMPORARY', label: 'Temporary' },
]

function splitPlaces(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function SearchPage() {
  const search = useBasicSearchMutation()
  const save = useSaveApplicationMutation()
  const presets = useSearchPresetsQuery()
  const createPreset = useCreateSearchPresetMutation()
  const deletePreset = useDeleteSearchPresetMutation()

  const [discoverOpen, setDiscoverOpen] = useState(false)
  const suggestions = useSuggestionsQuery(discoverOpen)

  const [phrase, setPhrase] = useState('')
  const [placesText, setPlacesText] = useState('')
  const [jobTypes, setJobTypes] = useState<string[]>([])
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([])
  const [contractTypes, setContractTypes] = useState<string[]>([])
  const [postedWithin, setPostedWithin] = useState<string>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [selectedJobUuid, setSelectedJobUuid] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const detail = useJobDetailQuery(selectedJobUuid)

  function buildRequest(searchPhrase: string, places: string[]): BasicSearchRequest {
    return {
      phrase: searchPhrase.trim() || undefined,
      places,
      job_types: jobTypes,
      employment_types: employmentTypes,
      contract_types: contractTypes,
      posted_within_days: postedWithin ? Number(postedWithin) : null,
      page: 1,
      size: 20,
    }
  }

  function runSearch(searchPhrase: string, places: string[], role: string | null) {
    setActiveRole(role)
    setSelectedJobUuid(null)
    setSavedId(null)
    search.mutate(buildRequest(searchPhrase, places))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (phrase.trim().length === 0) return
    runSearch(phrase, splitPlaces(placesText), null)
  }

  function explore(role: string, searchPhrase: string) {
    setPhrase(searchPhrase)
    runSearch(searchPhrase, splitPlaces(placesText), role)
  }

  const savedRoleNames = new Set((presets.data?.items ?? []).map((preset) => preset.name.toLowerCase()))

  function bookmarkRole(role: string, searchPhrase: string) {
    if (savedRoleNames.has(role.toLowerCase())) return
    createPreset.mutate({ name: role, query_json: { phrase: searchPhrase, places: splitPlaces(placesText) } })
  }

  function exploreSaved(name: string, query: Record<string, unknown>) {
    const savedPhrase = typeof query.phrase === 'string' ? query.phrase : name
    const savedPlaces = Array.isArray(query.places) ? query.places.map(String) : []
    setPhrase(savedPhrase)
    if (savedPlaces.length > 0) setPlacesText(savedPlaces.join(', '))
    runSearch(savedPhrase, savedPlaces, name)
  }

  function saveJob() {
    if (!selectedJobUuid) return
    save.mutate(selectedJobUuid, { onSuccess: (app) => setSavedId(app.id) })
  }

  const result = search.data
  const cards = suggestions.data?.suggestions ?? []
  const savedRoles = presets.data?.items ?? []
  const selectedSummary = result?.jobs.find((job) => job.uuid === selectedJobUuid) ?? null
  const loadingSuggestions = suggestions.isFetching
  const hasSavedRoles = savedRoles.length > 0

  // Adapt once presets resolve: new users get discovery open; returning users start with
  // their saved roles and the most recent one's postings, discovery collapsed.
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current || presets.isPending) return
    initRef.current = true
    if (hasSavedRoles) {
      const recent = savedRoles[0]
      exploreSaved(recent.name, recent.query_json)
    } else {
      setDiscoverOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets.isPending])

  return (
    <section className="discover-layout" aria-labelledby="discover-title">
      <div className="section-heading">
        <p className="eyebrow">Discover</p>
        <h2 id="discover-title">{hasSavedRoles ? 'Your saved roles' : 'Find your next role'}</h2>
        <p className="section-copy">
          {hasSavedRoles
            ? 'Pick a saved role to see fresh postings, or search for something new. Bookmark the jobs worth pursuing — they land on your Board.'
            : 'Let the assistant suggest roles that fit you, explore the live market, and bookmark the roles and jobs worth pursuing.'}
        </p>
      </div>

      {/* ── Saved roles (primary for returning users) ── */}
      {hasSavedRoles ? (
        <div className="page-section saved-roles">
          <div className="card-heading">
            <h3>Saved roles</h3>
            <span className="muted">Click to see current postings</span>
          </div>
          <div className="chip-row">
            {savedRoles.map((preset) => (
              <span className={activeRole === preset.name ? 'saved-role-chip saved-role-chip-active' : 'saved-role-chip'} key={preset.id}>
                <button type="button" onClick={() => exploreSaved(preset.name, preset.query_json)}>{preset.name}</button>
                <button type="button" className="saved-role-remove" aria-label={`Remove ${preset.name}`} onClick={() => deletePreset.mutate(preset.id)}>×</button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Search bar ──────────────────────────────── */}
      <form className="page-section search-bar" onSubmit={submit}>
        <div className="search-bar-row">
          <label className="search-bar-phrase">
            Search roles or keywords
            <input value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="e.g. Data Analyst, Python…" />
          </label>
          <label className="search-bar-place">
            City (comma-separate for nearby)
            <input value={placesText} onChange={(event) => setPlacesText(event.target.value)} placeholder="Nürnberg, Fürth, Erlangen" />
          </label>
          <button type="submit" disabled={search.isPending || phrase.trim().length === 0}>
            {search.isPending ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div className="search-bar-foot">
          <button type="button" className="link-toggle" onClick={() => setFiltersOpen((open) => !open)}>
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
          {phrase.trim().length > 0 ? (
            <button
              type="button"
              className="link-toggle"
              onClick={() => bookmarkRole(phrase.trim(), phrase.trim())}
              disabled={savedRoleNames.has(phrase.trim().toLowerCase()) || createPreset.isPending}
            >
              ☆ Bookmark this role
            </button>
          ) : null}
        </div>
        {filtersOpen ? (
          <div className="search-filters">
            <div className="facet-group">
              <h4>Posted within</h4>
              <select className="posted-select" value={postedWithin} onChange={(event) => setPostedWithin(event.target.value)}>
                <option value="">Any time</option>
                <option value="1">Last 24 hours</option>
                <option value="3">Last 3 days</option>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
            <ChipFilter label="Role type" options={jobTypeOptions} values={jobTypes} onChange={setJobTypes} />
            <ChipFilter label="Working time" options={employmentTypeOptions} values={employmentTypes} onChange={setEmploymentTypes} />
            <ChipFilter label="Contract" options={contractTypeOptions} values={contractTypes} onChange={setContractTypes} />
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
            {result.jobs.length === 0 ? <p className="muted">No openings matched. Try a broader phrase, fewer cities, or remove filters.</p> : null}
            <div className="job-list">
              {result.jobs.map((job) => (
                <button
                  key={job.uuid}
                  type="button"
                  className={job.uuid === selectedJobUuid ? 'job-row job-row-active' : 'job-row'}
                  onClick={() => { setSelectedJobUuid(job.uuid); setSavedId(null) }}
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
      ) : !hasSavedRoles && !discoverOpen ? (
        <p className="muted discover-hint">Search above, or open “Roles that fit you” to discover.</p>
      ) : null}

      {/* ── Discover (secondary; collapsed for returning users) ── */}
      <div className="page-section rec-section">
        <button type="button" className="rec-toggle" onClick={() => setDiscoverOpen((open) => !open)} aria-expanded={discoverOpen}>
          <span>✨ Roles that fit you</span>
          <span className="muted">{discoverOpen ? 'Hide' : 'Discover more'}</span>
        </button>

        {discoverOpen ? (
          <>
            <div className="rec-toolbar">
              <p className="muted">Generated from your profile. Click to explore, ☆ to bookmark.</p>
              <button type="button" className="secondary-button" onClick={() => suggestions.refetch()} disabled={loadingSuggestions}>
                {loadingSuggestions ? 'Thinking…' : 'Refresh'}
              </button>
            </div>

            {loadingSuggestions && cards.length === 0 ? <p className="muted">Looking at your profile…</p> : null}
            {suggestions.isError ? (
              <div className="notice notice-error">Couldn't generate recommendations right now. Build your profile, then refresh.</div>
            ) : null}
            {!loadingSuggestions && cards.length === 0 && !suggestions.isError ? (
              <p className="muted">No recommendations yet — build your profile first, then refresh.</p>
            ) : null}

            <div className="rec-grid">
              {cards.map((card) => {
                const bookmarked = savedRoleNames.has(card.role.toLowerCase())
                return (
                  <div key={card.role} className={activeRole === card.role ? 'rec-card rec-card-active' : 'rec-card'}>
                    <button
                      type="button"
                      className="rec-bookmark"
                      title={bookmarked ? 'Bookmarked' : 'Bookmark this role'}
                      aria-label={bookmarked ? 'Bookmarked' : 'Bookmark this role'}
                      onClick={() => bookmarkRole(card.role, card.phrase)}
                      disabled={bookmarked || createPreset.isPending}
                    >
                      {bookmarked ? '★' : '☆'}
                    </button>
                    <button type="button" className="rec-body" onClick={() => explore(card.role, card.phrase)}>
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
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </div>
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
      <QuickFitCheck jobUuid={summary.uuid} />
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

const verdictMeta: Record<string, { label: string; icon: string; cls: string }> = {
  STRONG: { label: 'Strong fit', icon: '✓', cls: 'verdict-strong' },
  STRETCH: { label: 'Stretch', icon: '~', cls: 'verdict-stretch' },
  WEAK: { label: 'Weak fit', icon: '✗', cls: 'verdict-weak' },
}

function QuickFitCheck({ jobUuid }: { jobUuid: string }) {
  const quickFit = useQuickFitMutation()
  const result = quickFit.data
  // reset when the selected job changes
  if (quickFit.variables && quickFit.variables !== jobUuid && !quickFit.isPending) {
    quickFit.reset()
  }

  if (!result) {
    return (
      <div className="quickfit-cta">
        <button type="button" className="secondary-button" onClick={() => quickFit.mutate(jobUuid)} disabled={quickFit.isPending}>
          {quickFit.isPending ? 'Checking fit…' : '⚡ Quick fit check'}
        </button>
        <span className="muted">See if it’s worth applying — before you tailor.</span>
        {quickFit.isError ? <span className="muted">Couldn’t check fit right now.</span> : null}
      </div>
    )
  }

  const meta = verdictMeta[result.verdict] ?? verdictMeta.STRETCH
  return (
    <div className={`quickfit-result ${meta.cls}`}>
      <div className="quickfit-head">
        <span className="quickfit-badge">{meta.icon} {meta.label}</span>
        <button type="button" className="link-toggle" onClick={() => quickFit.mutate(jobUuid)} disabled={quickFit.isPending}>
          {quickFit.isPending ? '…' : 'Recheck'}
        </button>
      </div>
      {result.headline ? <p className="quickfit-headline">{result.headline}</p> : null}
      {result.top_gaps.length > 0 ? (
        <ul className="quickfit-gaps">
          {result.top_gaps.map((gap, index) => (
            <li key={index}>{gap}</li>
          ))}
        </ul>
      ) : null}
    </div>
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
