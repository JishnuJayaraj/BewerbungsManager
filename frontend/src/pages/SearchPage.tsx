import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  ApiError,
  useAdvancedSearchMutation,
  useAutocompleteQuery,
  useBasicSearchMutation,
  useCreateSearchPresetMutation,
  useDeleteSearchPresetMutation,
  useJobDetailQuery,
  useSaveApplicationMutation,
  useSearchPresetsQuery,
  useSuggestionsMutation,
  type BasicSearchRequest,
  type JobDetail,
  type JobSummary,
  type SearchBody,
  type SearchResponse,
} from '../api'

type BasicSearchForm = {
  phrase: string
  locationKey: string
  radiusKm: string
  jobTypes: string[]
  employmentTypes: string[]
}

type AdvancedSearchForm = {
  phrase: string
  queryMode: 'keyword' | 'semantic'
  queryType: 'must' | 'should' | 'must_not'
  contractTypes: string[]
  occupationArea: string
  companyType: string
  dateFrom: string
  dateTo: string
  hasEndDate: boolean
  pageSize: string
}

type LocationOption = {
  key: string
  label: string
  lat: number
  lon: number
}

type FacetItem = {
  value: string
  jobs: number
}

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
  { value: 'APPRENTICESHIP', label: 'Apprenticeship' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'THESIS', label: 'Thesis' },
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

const companyTypeOptions = [
  { value: '', label: 'Any company type' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'PERSONNEL_SERVICES', label: 'Personnel services' },
  { value: 'RECRUITMENT_AGENCY', label: 'Recruitment agency' },
]

const initialBasicForm: BasicSearchForm = {
  phrase: 'Python',
  locationKey: '',
  radiusKm: '30',
  jobTypes: [],
  employmentTypes: [],
}

const initialAdvancedForm: AdvancedSearchForm = {
  phrase: 'backend python',
  queryMode: 'keyword',
  queryType: 'must',
  contractTypes: [],
  occupationArea: '',
  companyType: '',
  dateFrom: '',
  dateTo: '',
  hasEndDate: false,
  pageSize: '20',
}

export function SearchPage() {
  const [basicForm, setBasicForm] = useState<BasicSearchForm>(initialBasicForm)
  const [advancedForm, setAdvancedForm] = useState<AdvancedSearchForm>(initialAdvancedForm)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [activeBody, setActiveBody] = useState<SearchBody | null>(null)
  const [selectedJobUuid, setSelectedJobUuid] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('')
  const [savedApplicationId, setSavedApplicationId] = useState<string | null>(null)

  const basicSearch = useBasicSearchMutation()
  const advancedSearch = useAdvancedSearchMutation()
  const presets = useSearchPresetsQuery()
  const createPreset = useCreateSearchPresetMutation()
  const deletePreset = useDeleteSearchPresetMutation()
  const saveApplication = useSaveApplicationMutation()
  const suggestions = useSuggestionsMutation()
  const detail = useJobDetailQuery(selectedJobUuid)
  const autocomplete = useAutocompleteQuery(basicForm.phrase)

  const currentError =
    basicSearch.error ??
    advancedSearch.error ??
    createPreset.error ??
    deletePreset.error ??
    saveApplication.error ??
    suggestions.error ??
    detail.error

  const selectedJob = useMemo(
    () => result?.jobs.find((job) => job.uuid === selectedJobUuid) ?? null,
    [result, selectedJobUuid],
  )

  function runBasic(event?: FormEvent<HTMLFormElement>, nextForm = basicForm) {
    event?.preventDefault()
    const request = basicFormToRequest(nextForm)
    basicSearch.mutate(request, {
      onSuccess: (data) => {
        setResult(data)
        setActiveBody(basicFormToSearchBody(nextForm))
        setSelectedJobUuid(data.jobs[0]?.uuid ?? null)
        setSavedApplicationId(null)
      },
    })
  }

  function runAdvanced(event?: FormEvent<HTMLFormElement>, body = advancedFormToSearchBody(advancedForm)) {
    event?.preventDefault()
    advancedSearch.mutate(body, {
      onSuccess: (data) => {
        setResult(data)
        setActiveBody(body)
        setSelectedJobUuid(data.jobs[0]?.uuid ?? null)
        setSavedApplicationId(null)
      },
    })
  }

  function savePreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeBody || presetName.trim().length === 0) {
      return
    }
    createPreset.mutate(
      { name: presetName.trim(), query_json: activeBody },
      { onSuccess: () => setPresetName('') },
    )
  }

  function replayPreset(body: SearchBody) {
    setAdvancedOpen(true)
    runAdvanced(undefined, body)
  }

  function applyFacet(field: string, value: string) {
    const body = activeBody ? cloneSearchBody(activeBody) : basicFormToSearchBody(basicForm)
    const filters = Array.isArray(body.filters) ? [...body.filters] : []
    filters.push({ type: 'text', field, in: [value] })
    runAdvanced(undefined, { ...body, filters, page: 1 })
  }

  function runSuggestion(body: SearchBody) {
    setAdvancedOpen(true)
    runAdvanced(undefined, body)
  }

  function saveSelectedJob() {
    if (!selectedJobUuid) {
      return
    }
    saveApplication.mutate(selectedJobUuid, {
      onSuccess: (application) => setSavedApplicationId(application.id),
    })
  }

  return (
    <section className="search-layout" aria-labelledby="search-title">
      <div className="section-heading search-heading">
        <div>
          <p className="eyebrow">Search</p>
          <h2 id="search-title">Job search</h2>
        </div>
        <button type="button" className="secondary-button" onClick={() => suggestions.mutate()}>
          {suggestions.isPending ? 'Loading...' : 'Roles that fit you'}
        </button>
      </div>

      {currentError ? <ErrorNotice error={currentError} /> : null}

      {suggestions.data ? (
        <div className="suggestion-strip" aria-label="Role suggestions">
          {suggestions.data.suggestions.map((suggestion) => (
            <button
              type="button"
              className="suggestion-chip"
              key={suggestion.role}
              onClick={() => runSuggestion(suggestion.search)}
            >
              <strong>{suggestion.role}</strong>
              <span>{suggestion.rationale}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="search-grid">
        <aside className="search-sidebar">
          <form className="search-panel" onSubmit={(event) => runBasic(event)}>
            <div className="card-heading">
              <h3>Basic search</h3>
              <button type="submit" disabled={basicSearch.isPending}>
                {basicSearch.isPending ? 'Searching...' : 'Search'}
              </button>
            </div>
            <label>
              Phrase
              <input
                value={basicForm.phrase}
                list="search-autocomplete"
                onChange={(event) => setBasicForm({ ...basicForm, phrase: event.target.value })}
              />
            </label>
            <datalist id="search-autocomplete">
              {autocomplete.data?.map((item) => (
                <option key={item.uuid} value={item.title ?? item.company ?? ''} />
              ))}
            </datalist>
            <div className="field-grid">
              <label>
                Location
                <select
                  value={basicForm.locationKey}
                  onChange={(event) => setBasicForm({ ...basicForm, locationKey: event.target.value })}
                >
                  <option value="">Anywhere</option>
                  {locations.map((location) => (
                    <option key={location.key} value={location.key}>{location.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Radius
                <input
                  type="number"
                  min="1"
                  value={basicForm.radiusKm}
                  onChange={(event) => setBasicForm({ ...basicForm, radiusKm: event.target.value })}
                />
              </label>
            </div>
            <CheckboxGroup
              label="Role type"
              options={jobTypeOptions}
              values={basicForm.jobTypes}
              onChange={(jobTypes) => setBasicForm({ ...basicForm, jobTypes })}
            />
            <CheckboxGroup
              label="Working time"
              options={employmentTypeOptions}
              values={basicForm.employmentTypes}
              onChange={(employmentTypes) => setBasicForm({ ...basicForm, employmentTypes })}
            />
          </form>

          <section className="search-panel">
            <button
              type="button"
              className="accordion-button"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              Advanced filters
              <span>{advancedOpen ? 'Hide' : 'Show'}</span>
            </button>
            {advancedOpen ? (
              <form className="advanced-form" onSubmit={(event) => runAdvanced(event)}>
                <label>
                  Search text
                  <input
                    value={advancedForm.phrase}
                    onChange={(event) => setAdvancedForm({ ...advancedForm, phrase: event.target.value })}
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Search style
                    <select
                      value={advancedForm.queryMode}
                      onChange={(event) =>
                        setAdvancedForm({ ...advancedForm, queryMode: event.target.value as AdvancedSearchForm['queryMode'] })
                      }
                    >
                      <option value="keyword">Keyword</option>
                      <option value="semantic">Semantic</option>
                    </select>
                  </label>
                  <label>
                    Match behavior
                    <select
                      value={advancedForm.queryType}
                      onChange={(event) =>
                        setAdvancedForm({ ...advancedForm, queryType: event.target.value as AdvancedSearchForm['queryType'] })
                      }
                    >
                      <option value="must">Required</option>
                      <option value="should">Boost</option>
                      <option value="must_not">Exclude</option>
                    </select>
                  </label>
                </div>
                <CheckboxGroup
                  label="Contract"
                  options={contractTypeOptions}
                  values={advancedForm.contractTypes}
                  onChange={(contractTypes) => setAdvancedForm({ ...advancedForm, contractTypes })}
                />
                <div className="field-grid">
                  <label>
                    Occupation area
                    <input
                      value={advancedForm.occupationArea}
                      placeholder="IT"
                      onChange={(event) => setAdvancedForm({ ...advancedForm, occupationArea: event.target.value })}
                    />
                  </label>
                  <label>
                    Company type
                    <select
                      value={advancedForm.companyType}
                      onChange={(event) => setAdvancedForm({ ...advancedForm, companyType: event.target.value })}
                    >
                      {companyTypeOptions.map((option) => (
                        <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Posted from
                    <input
                      type="date"
                      value={advancedForm.dateFrom}
                      onChange={(event) => setAdvancedForm({ ...advancedForm, dateFrom: event.target.value })}
                    />
                  </label>
                  <label>
                    Posted until
                    <input
                      type="date"
                      value={advancedForm.dateTo}
                      onChange={(event) => setAdvancedForm({ ...advancedForm, dateTo: event.target.value })}
                    />
                  </label>
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={advancedForm.hasEndDate}
                    onChange={(event) => setAdvancedForm({ ...advancedForm, hasEndDate: event.target.checked })}
                  />
                  Only postings with an end date
                </label>
                <label>
                  Results per page
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={advancedForm.pageSize}
                    onChange={(event) => setAdvancedForm({ ...advancedForm, pageSize: event.target.value })}
                  />
                </label>
                <button type="submit" disabled={advancedSearch.isPending}>
                  {advancedSearch.isPending ? 'Searching...' : 'Run advanced'}
                </button>
              </form>
            ) : null}
          </section>

          <PresetsPanel
            activeBody={activeBody}
            presetName={presetName}
            setPresetName={setPresetName}
            presets={presets.data?.items ?? []}
            loading={presets.isPending}
            saving={createPreset.isPending}
            deletingId={deletePreset.variables}
            onSave={savePreset}
            onReplay={replayPreset}
            onDelete={(id) => deletePreset.mutate(id)}
          />

          {result ? <FacetsPanel aggregations={result.aggregations} onApply={applyFacet} /> : null}
        </aside>

        <div className="search-results">
          <ResultsPanel
            result={result}
            selectedUuid={selectedJobUuid}
            onSelect={(uuid) => {
              setSelectedJobUuid(uuid)
              setSavedApplicationId(null)
            }}
          />
        </div>

        <JobDetailPanel
          summary={selectedJob}
          detail={detail.data}
          loading={detail.isPending && Boolean(selectedJobUuid)}
          onSave={saveSelectedJob}
          saving={saveApplication.isPending}
          savedApplicationId={savedApplicationId}
          saveError={saveApplication.error}
        />
      </div>
    </section>
  )
}

function PresetsPanel({
  activeBody,
  presetName,
  setPresetName,
  presets,
  loading,
  saving,
  deletingId,
  onSave,
  onReplay,
  onDelete,
}: {
  activeBody: SearchBody | null
  presetName: string
  setPresetName: (value: string) => void
  presets: Array<{ id: string; name: string; query_json: SearchBody }>
  loading: boolean
  saving: boolean
  deletingId: string | undefined
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onReplay: (body: SearchBody) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="search-panel">
      <h3>Saved presets</h3>
      <form className="preset-form" onSubmit={onSave}>
        <input
          value={presetName}
          placeholder="Preset name"
          onChange={(event) => setPresetName(event.target.value)}
        />
        <button type="submit" disabled={!activeBody || presetName.trim().length === 0 || saving}>
          Save
        </button>
      </form>
      {loading ? <p className="muted">Loading presets...</p> : null}
      <div className="preset-list">
        {presets.map((preset) => (
          <div className="preset-row" key={preset.id}>
            <button type="button" className="link-button" onClick={() => onReplay(preset.query_json)}>
              {preset.name}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={deletingId === preset.id}
              onClick={() => onDelete(preset.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function FacetsPanel({
  aggregations,
  onApply,
}: {
  aggregations: Record<string, unknown>
  onApply: (field: string, value: string) => void
}) {
  return (
    <section className="search-panel">
      <h3>Refine results</h3>
      <FacetList
        title="Working time"
        items={facetItems(aggregations.employmentTypes)}
        onApply={(value) => onApply('classifications.employmentTypes', value)}
      />
      <FacetList
        title="Role type"
        items={facetItems(aggregations.jobTypes)}
        onApply={(value) => onApply('classifications.jobTypes', value)}
      />
      <FacetList
        title="Occupation"
        items={facetItems(aggregations.occupationAreas)}
        onApply={(value) => onApply('classifications.occupationAreas', value)}
      />
      <FacetList title="Sources" items={facetItems(aggregations.sources)} />
    </section>
  )
}

function FacetList({
  title,
  items,
  onApply,
}: {
  title: string
  items: FacetItem[]
  onApply?: (value: string) => void
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="facet-group">
      <h4>{title}</h4>
      {items.slice(0, 6).map((item) => (
        <button
          type="button"
          className="facet-button"
          key={item.value}
          disabled={!onApply}
          onClick={() => onApply?.(item.value)}
        >
          <span>{displayValue(item.value)}</span>
          <strong>{item.jobs}</strong>
        </button>
      ))}
    </div>
  )
}

function ResultsPanel({
  result,
  selectedUuid,
  onSelect,
}: {
  result: SearchResponse | null
  selectedUuid: string | null
  onSelect: (uuid: string) => void
}) {
  if (!result) {
    return (
      <section className="results-empty">
        <h3>Run a search</h3>
        <p className="muted">Use basic search for the common path or open advanced filters for exact HR4U searches.</p>
      </section>
    )
  }

  return (
    <section className="results-panel search-results-panel">
      <div className="results-header">
        <h3>Results</h3>
        <span>{result.hits} hits</span>
      </div>
      <p className="muted">
        Page {result.page}, showing {result.jobs.length}; {result.deduped} duplicate rows removed.
      </p>
      <div className="job-list">
        {result.jobs.map((job) => (
          <button
            type="button"
            key={job.uuid}
            className={job.uuid === selectedUuid ? 'job-row job-row-active' : 'job-row'}
            onClick={() => onSelect(job.uuid)}
          >
            <strong>{job.title ?? 'Untitled role'}</strong>
            <span>{[job.company, job.place].filter(Boolean).join(' - ') || 'Company/location not listed'}</span>
            <small>{[...job.employment_types, ...job.job_types].map(displayValue).join(' / ')}</small>
          </button>
        ))}
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
  savedApplicationId,
  saveError,
}: {
  summary: JobSummary | null
  detail: JobDetail | undefined
  loading: boolean
  onSave: () => void
  saving: boolean
  savedApplicationId: string | null
  saveError: Error | null
}) {
  if (!summary) {
    return (
      <aside className="job-detail-panel">
        <h3>Job detail</h3>
        <p className="muted">Select a result to inspect the posting.</p>
      </aside>
    )
  }

  const title = detail?.text.title ?? summary.title ?? 'Untitled role'
  const company = detail?.companyCleaned ?? detail?.company ?? summary.company
  const firstAddress = detail?.addresses[0]

  return (
    <aside className="job-detail-panel">
      <div className="card-heading">
        <h3>{title}</h3>
        <button type="button" onClick={onSave} disabled={saving || Boolean(savedApplicationId)}>
          {saving ? 'Saving...' : savedApplicationId ? 'Saved' : 'Save'}
        </button>
      </div>
      <p className="muted">{[company, firstAddress?.place ?? summary.place].filter(Boolean).join(' - ')}</p>
      {savedApplicationId ? (
        <div className="notice">
          Saved to board. <Link to={`/workspace/${savedApplicationId}`}>Open workspace</Link>
        </div>
      ) : null}
      {saveError ? <ErrorNotice error={saveError} /> : null}
      {loading ? <p className="muted">Loading job detail...</p> : null}
      {detail?.link ? (
        <p>
          <a href={detail.link} target="_blank" rel="noreferrer">Open original posting</a>
        </p>
      ) : null}
      <DetailList title="Tasks" items={detail?.text.tasks ?? []} />
      <DetailList title="Requirements" items={detail?.text.requirements ?? []} />
      <DetailList title="Benefits" items={detail?.text.benefits ?? []} />
      {detail?.text.fulltext ? <p className="job-fulltext">{detail.text.fulltext}</p> : null}
    </aside>
  )
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="detail-list">
      <h4>{title}</h4>
      <ul>
        {items.slice(0, 6).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function CheckboxGroup({
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
    <fieldset className="checkbox-group">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={values.includes(option.value)}
            onChange={(event) => {
              onChange(
                event.target.checked
                  ? [...values, option.value]
                  : values.filter((value) => value !== option.value),
              )
            }}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}

function ErrorNotice({ error }: { error: Error }) {
  const message =
    error instanceof ApiError
      ? error.code === 'conflict'
        ? 'This job is already saved on your board.'
        : `${error.status} ${error.code}: ${error.message}`
      : error.message
  return <div className="notice notice-error" role="alert">{message}</div>
}

function basicFormToRequest(form: BasicSearchForm): BasicSearchRequest {
  const location = locations.find((item) => item.key === form.locationKey)
  return {
    phrase: nullIfEmpty(form.phrase) ?? undefined,
    location: location
      ? {
          lat: location.lat,
          lon: location.lon,
          radius_km: positiveNumber(form.radiusKm, 30),
        }
      : undefined,
    job_types: form.jobTypes,
    employment_types: form.employmentTypes,
    page: 1,
    size: 20,
  }
}

function basicFormToSearchBody(form: BasicSearchForm): SearchBody {
  const request = basicFormToRequest(form)
  const queries = request.phrase
    ? [
        {
          autocomplete: false,
          fields: ['text.title', 'company'],
          phrase: request.phrase,
          queryType: 'must',
          type: 'single',
        },
      ]
    : []
  const filters: Array<Record<string, unknown>> = []
  if (request.location) {
    filters.push({
      type: 'distance',
      lat: request.location.lat,
      lon: request.location.lon,
      distance: request.location.radius_km,
    })
  }
  if (request.job_types.length > 0) {
    filters.push({ type: 'text', field: 'classifications.jobTypes', in: request.job_types })
  }
  if (request.employment_types.length > 0) {
    filters.push({ type: 'text', field: 'classifications.employmentTypes', in: request.employment_types })
  }
  return {
    queries,
    filters,
    aggregations: ['employmentTypes', 'jobTypes', 'occupationAreas', 'sources'],
    page: request.page,
    size: request.size,
  }
}

function advancedFormToSearchBody(form: AdvancedSearchForm): SearchBody {
  const queries: Array<Record<string, unknown>> = []
  if (form.phrase.trim()) {
    queries.push(
      form.queryMode === 'semantic'
        ? { type: 'semantic', phrase: form.phrase.trim(), queryType: form.queryType }
        : {
            type: 'single',
            autocomplete: false,
            fields: ['text.title', 'text.fulltext', 'company'],
            phrase: form.phrase.trim(),
            queryType: form.queryType,
          },
    )
  }

  const filters: Array<Record<string, unknown>> = []
  if (form.contractTypes.length > 0) {
    filters.push({ type: 'text', field: 'classifications.contractTypes', in: form.contractTypes })
  }
  if (form.occupationArea.trim()) {
    filters.push({ type: 'text', field: 'classifications.occupationAreas', is: form.occupationArea.trim() })
  }
  if (form.companyType) {
    filters.push({ type: 'text', field: 'classifications.companyType', is: form.companyType })
  }
  if (form.dateFrom || form.dateTo) {
    filters.push({
      type: 'date',
      field: 'period.dateFrom',
      ...(form.dateFrom ? { from: form.dateFrom } : {}),
      ...(form.dateTo ? { to: form.dateTo } : {}),
    })
  }
  if (form.hasEndDate) {
    filters.push({ type: 'isSet', field: 'period.dateTo' })
  }

  return {
    queries,
    filters,
    aggregations: ['employmentTypes', 'jobTypes', 'occupationAreas', 'companyTypes', 'contractTypes', 'sources'],
    page: 1,
    size: positiveNumber(form.pageSize, 20),
  }
}

function facetItems(value: unknown): FacetItem[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }
    const record = item as Record<string, unknown>
    return typeof record.value === 'string' && typeof record.jobs === 'number'
      ? [{ value: record.value, jobs: record.jobs }]
      : []
  })
}

function cloneSearchBody(body: SearchBody): SearchBody {
  return JSON.parse(JSON.stringify(body)) as SearchBody
}

function displayValue(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function nullIfEmpty(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function positiveNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
