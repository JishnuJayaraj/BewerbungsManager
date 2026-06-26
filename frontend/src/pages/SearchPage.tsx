import { type FormEvent, useState } from 'react'
import { ApiError, useBasicSearchQuery } from '../api'

export function SearchPage() {
  const [draftPhrase, setDraftPhrase] = useState('Python')
  const [submittedPhrase, setSubmittedPhrase] = useState('Python')
  const request = {
    phrase: submittedPhrase,
    job_types: [],
    employment_types: [],
    page: 1,
    size: 5,
  }
  const search = useBasicSearchQuery(request, submittedPhrase.trim().length > 0)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittedPhrase(draftPhrase.trim())
  }

  return (
    <section className="page-section" aria-labelledby="search-title">
      <div className="section-heading">
        <p className="eyebrow">Search</p>
        <h2 id="search-title">Basic search check</h2>
        <p className="section-copy">Live results from the backend basic search endpoint.</p>
      </div>

      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          Phrase
          <input
            value={draftPhrase}
            onChange={(event) => setDraftPhrase(event.target.value)}
            placeholder="Python"
          />
        </label>
        <button type="submit">Run</button>
      </form>

      {search.isPending ? <p className="muted">Checking search...</p> : null}
      {search.isError ? (
        <div className="notice notice-error" role="alert">
          {search.error instanceof ApiError
            ? `${search.error.status} ${search.error.code}: ${search.error.message}`
            : search.error.message}
        </div>
      ) : null}
      {search.data ? (
        <div className="results-panel">
          <p className="muted">
            {search.data.hits} hits, {search.data.jobs.length} shown, {search.data.deduped} deduped
          </p>
          <ul className="compact-list">
            {search.data.jobs.map((job) => (
              <li key={job.uuid}>
                <strong>{job.title ?? 'Untitled role'}</strong>
                <span>
                  {[job.company, job.place].filter(Boolean).join(' - ') || 'Company/location not listed'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
