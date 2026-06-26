import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { CommsLogPanel } from '../components/ApplicationPanels'
import {
  ApiError,
  useApplicationBriefQuery,
  useApplicationQuery,
  useApplicationsQuery,
  useArtifactsQuery,
  useExportArtifactMutation,
  useFitQuery,
  useGenerateArtifactMutation,
  usePatchApplicationMutation,
  useRunFitMutation,
  useUpdateApplicationBriefMutation,
  coverLetterContentSchema,
  cvBulletSuggestionsContentSchema,
  portalAnswerContentSchema,
  type Application,
  type ApplicationBrief,
  type ApplicationStatus,
  type GeneratedArtifact,
  type GeneratableArtifactKind,
  type FitResponse,
  type RequirementCheck,
} from '../api'

const stageOptions: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'SAVED', label: 'Saved' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
]

type BriefForm = {
  target_angle: string
  emphasize: string[]
  avoid: string
  tone: string
  language: 'DE' | 'EN'
  company_motivation: string
  user_notes: string
  free_emphasis: string
}

const emptyBriefForm: BriefForm = {
  target_angle: '',
  emphasize: [],
  avoid: '',
  tone: 'direct, professional',
  language: 'DE',
  company_motivation: '',
  user_notes: '',
  free_emphasis: '',
}

const artifactKinds: Array<{ kind: GeneratableArtifactKind; label: string }> = [
  { kind: 'COVER_LETTER', label: 'Cover letter' },
  { kind: 'CV_BULLET_SUGGESTIONS', label: 'CV bullets' },
  { kind: 'PORTAL_ANSWER', label: 'Portal answer' },
]

export function WorkspacePage() {
  const { applicationId } = useParams()
  if (!applicationId) {
    return <WorkspacePicker />
  }
  return <WorkspaceDetail applicationId={applicationId} />
}

function WorkspacePicker() {
  const applications = useApplicationsQuery()
  return (
    <section className="workspace-layout" aria-labelledby="workspace-title">
      <div className="section-heading">
        <p className="eyebrow">Workspace</p>
        <h2 id="workspace-title">Select an application</h2>
      </div>
      {applications.isError ? <ErrorNotice error={applications.error} /> : null}
      <div className="workspace-list">
        {applications.data?.items.map((application) => (
          <Link className="workspace-list-item" to={`/workspace/${application.id}`} key={application.id}>
            <strong>{application.job_title}</strong>
            <span>{application.company ?? 'Company not listed'}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function WorkspaceDetail({ applicationId }: { applicationId: string }) {
  const application = useApplicationQuery(applicationId)
  const brief = useApplicationBriefQuery(applicationId)
  const fit = useFitQuery(applicationId)
  const updateBrief = useUpdateApplicationBriefMutation(applicationId)
  const runFit = useRunFitMutation(applicationId)
  const [form, setForm] = useState<BriefForm>(emptyBriefForm)

  useEffect(() => {
    if (brief.data) setForm(briefToForm(brief.data))
  }, [brief.data])

  const jobTitle = stringAt(application.data?.job_snapshot, ['text', 'title']) ?? application.data?.job_title ?? ''

  function saveBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateBrief.mutate(formToBriefRequest(form))
  }

  return (
    <section className="workspace-layout" aria-labelledby="workspace-title">
      <div className="section-heading workspace-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2 id="workspace-title">{jobTitle || 'Application workspace'}</h2>
        </div>
        <Link className="cta-link cta-link-quiet" to="/board">← Board</Link>
      </div>

      {application.isError ? <ErrorNotice error={application.error} /> : null}

      {application.data ? <JobSnapshot application={application.data} /> : null}
      {application.data ? <TrackingCard application={application.data} /> : null}

      <MatchSection
        fit={fit.data}
        fitError={fit.error}
        running={runFit.isPending}
        runError={runFit.error}
        onRun={() => runFit.mutate()}
      />

      <TailoringForm
        form={form}
        setForm={setForm}
        saving={updateBrief.isPending}
        error={updateBrief.error}
        suggestedAngle={fit.data?.fit.suggested_angle ?? null}
        onSubmit={saveBrief}
      />

      <ArtifactsPanel applicationId={applicationId} />

      <details className="board-accordion">
        <summary><span>Communication log</span></summary>
        <CommsLogPanel applicationId={applicationId} compact />
      </details>
    </section>
  )
}

function TrackingCard({ application }: { application: Application }) {
  const patch = usePatchApplicationMutation()
  const [nextAction, setNextAction] = useState(application.next_action ?? '')
  const [followup, setFollowup] = useState(application.followup_date ?? '')

  useEffect(() => {
    setNextAction(application.next_action ?? '')
    setFollowup(application.followup_date ?? '')
  }, [application.id, application.next_action, application.followup_date])

  function saveAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    patch.mutate({ id: application.id, input: { next_action: nullIfEmpty(nextAction), followup_date: nullIfEmpty(followup) } })
  }

  return (
    <section className="workspace-card tracking-card">
      <div className="tracking-row">
        <label className="stage-select">
          Stage
          <select
            value={application.status}
            onChange={(event) => patch.mutate({ id: application.id, input: { status: event.target.value as ApplicationStatus } })}
          >
            {stageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <form className="tracking-action" onSubmit={saveAction}>
          <label>
            Next step
            <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="e.g. tailor cover letter and apply" />
          </label>
          <label className="tracking-date">
            Follow-up
            <input type="date" value={followup} onChange={(event) => setFollowup(event.target.value)} />
          </label>
          <button type="submit" disabled={patch.isPending}>{patch.isPending ? 'Saving…' : 'Save'}</button>
        </form>
      </div>
      {patch.isError ? <ErrorNotice error={patch.error} /> : null}
    </section>
  )
}

function statusIcon(status: string): string {
  if (status === 'HAVE') return '✓'
  if (status === 'MISSING') return '✗'
  return '~'
}

function MatchSection({
  fit,
  fitError,
  running,
  runError,
  onRun,
}: {
  fit: FitResponse | undefined
  fitError: Error | null
  running: boolean
  runError: Error | null
  onRun: () => void
}) {
  const noFitYet = fitError instanceof ApiError && fitError.status === 404
  const missing = (fit?.requirements ?? []).filter((r) => effectiveStatus(r) === 'MISSING')
  const weakPoints = fit?.fit.weak_matches.map((m) => m.point).filter(Boolean) ?? []

  return (
    <section className="match-section">
      <div className="card-heading">
        <div>
          <h3>How you match this role</h3>
          <p className="muted">What the role needs, what you bring, and the honest gaps.</p>
        </div>
        <button type="button" onClick={onRun} disabled={running}>
          {running ? 'Analyzing…' : fit ? 'Re-analyze' : 'Analyze fit'}
        </button>
      </div>

      {runError ? <ErrorNotice error={runError} /> : null}
      {fitError && !noFitYet ? <ErrorNotice error={fitError} /> : null}
      {!fit && !running ? (
        <p className="muted">Run the analysis to see how your profile matches this job — strengths, gaps, and an angle.</p>
      ) : null}
      {running && !fit ? <p className="muted">Comparing your profile to the posting…</p> : null}

      {fit ? (
        <>
          <div className="match-summary">
            <p>{fit.fit.summary}</p>
            {fit.fit.suggested_angle ? (
              <p className="match-angle"><strong>Angle:</strong> {fit.fit.suggested_angle}</p>
            ) : null}
          </div>

          {fit.requirements.length > 0 ? (
            <div className="match-block">
              <h4>What the role needs</h4>
              <div className="match-req-list">
                {fit.requirements.map((req) => {
                  const status = effectiveStatus(req)
                  return (
                    <div className="match-req" key={req.id}>
                      <span className={`req-badge req-${status.toLowerCase()}`}>{statusIcon(status)} {status}</span>
                      <span className="match-req-text">{req.requirement}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="match-cols">
            <div className="match-block match-good">
              <h4>Your strengths</h4>
              {fit.fit.strong_matches.length === 0 ? <p className="muted">—</p> : null}
              <ul>
                {fit.fit.strong_matches.map((item, index) => (
                  <li key={index}>{item.point}</li>
                ))}
              </ul>
            </div>
            <div className="match-block match-gap">
              <h4>Gaps to address honestly</h4>
              {missing.length === 0 && weakPoints.length === 0 ? <p className="muted">No major gaps.</p> : null}
              <ul>
                {missing.map((req) => (
                  <li key={req.id}>{req.requirement}</li>
                ))}
                {weakPoints.map((point, index) => (
                  <li key={`w-${index}`}>{point}</li>
                ))}
              </ul>
            </div>
          </div>

          {fit.fit.risks_to_address.length > 0 ? (
            <div className="match-block">
              <h4>How to handle the gaps</h4>
              <div className="risk-list">
                {fit.fit.risks_to_address.map((risk, index) => (
                  <article key={index}>
                    <strong>{risk.risk}</strong>
                    <p>{risk.honest_framing}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function TailoringForm({
  form,
  setForm,
  saving,
  error,
  suggestedAngle,
  onSubmit,
}: {
  form: BriefForm
  setForm: (form: BriefForm) => void
  saving: boolean
  error: Error | null
  suggestedAngle: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <details className="board-accordion">
      <summary><span>Tailor this application</span></summary>
      <form className="board-detail-card tailor-form" onSubmit={onSubmit}>
        <p className="muted">These shape the tone and angle of the materials generated below — per job.</p>
        <div className="field-grid">
          <label>
            Tone
            <input value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value })} placeholder="direct, professional" />
          </label>
          <label>
            Language
            <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value as 'DE' | 'EN' })}>
              <option value="DE">German</option>
              <option value="EN">English</option>
            </select>
          </label>
        </div>
        <label>
          <span className="tailor-label-row">
            Positioning angle
            {suggestedAngle ? (
              <button type="button" className="link-toggle" onClick={() => setForm({ ...form, target_angle: suggestedAngle })}>
                Use suggested
              </button>
            ) : null}
          </span>
          <input value={form.target_angle} onChange={(event) => setForm({ ...form, target_angle: event.target.value })} placeholder="e.g. data analyst with strong BI/dashboarding focus" />
        </label>
        <label>
          Why this company?
          <textarea value={form.company_motivation} rows={2} onChange={(event) => setForm({ ...form, company_motivation: event.target.value })} />
        </label>
        <div className="row-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save tailoring'}</button>
        </div>
        {error ? <ErrorNotice error={error} /> : null}
      </form>
    </details>
  )
}

function ArtifactsPanel({ applicationId }: { applicationId: string }) {
  const [kind, setKind] = useState<GeneratableArtifactKind>('COVER_LETTER')
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [portalQuestion, setPortalQuestion] = useState('')
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const artifacts = useArtifactsQuery(applicationId, kind)
  const generate = useGenerateArtifactMutation(applicationId)
  const exportMutation = useExportArtifactMutation()

  useEffect(() => {
    const current = artifacts.data?.items.find((artifact) => artifact.is_current) ?? artifacts.data?.items[0]
    setSelectedArtifactId(current?.id ?? null)
  }, [artifacts.data, kind])

  const selectedArtifact =
    artifacts.data?.items.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts.data?.items[0] ?? null

  function submitGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (kind === 'PORTAL_ANSWER' && portalQuestion.trim().length === 0) {
      return
    }
    generate.mutate(
      {
        kind,
        instruction: nullIfEmpty(instruction),
        portal_question: kind === 'PORTAL_ANSWER' ? nullIfEmpty(portalQuestion) : undefined,
      },
      {
        onSuccess: (artifact) => {
          setSelectedArtifactId(artifact.id)
          setInstruction('')
        },
      },
    )
  }

  async function exportSelected(format: 'markdown' | 'pdf') {
    if (!selectedArtifact) {
      return
    }
    const exported = await exportMutation.mutateAsync({ artifact: selectedArtifact, format })
    const url = URL.createObjectURL(exported.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exported.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyMarkdown() {
    if (!selectedArtifact) {
      return
    }
    const exported = await exportMutation.mutateAsync({ artifact: selectedArtifact, format: 'markdown' })
    const text = await exported.blob.text()
    await navigator.clipboard.writeText(text)
    setCopyStatus('Copied Markdown')
  }

  return (
    <section className="workspace-card artifacts-panel">
      <div className="card-heading">
        <div>
          <h3>Application materials</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>Generate tailored materials grounded in your profile.</p>
        </div>
        {selectedArtifact?.has_unsupported ? <span className="unsupported-pill">Unsupported claims</span> : null}
      </div>
      <div className="artifact-tabs" role="tablist" aria-label="Artifact kinds">
        {artifactKinds.map((item) => (
          <button
            type="button"
            className={item.kind === kind ? 'artifact-tab artifact-tab-active' : 'artifact-tab'}
            key={item.kind}
            onClick={() => {
              setKind(item.kind)
              setCopyStatus(null)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <form className="artifact-generate-form" onSubmit={submitGenerate}>
        {kind === 'PORTAL_ANSWER' ? (
          <label>
            Portal question
            <textarea value={portalQuestion} rows={3} onChange={(event) => setPortalQuestion(event.target.value)} />
          </label>
        ) : null}
        <label>
          Regenerate instruction (optional)
          <input
            value={instruction}
            placeholder="make it shorter, use German B2 wording, emphasize Python"
            onChange={(event) => setInstruction(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={generate.isPending || (kind === 'PORTAL_ANSWER' && portalQuestion.trim().length === 0)}
        >
          {generate.isPending ? 'Generating…' : selectedArtifact ? 'Generate new version' : 'Generate'}
        </button>
      </form>
      {generate.error ? <ErrorNotice error={generate.error} /> : null}
      {artifacts.isError ? <ErrorNotice error={artifacts.error} /> : null}
      {artifacts.data && artifacts.data.items.length > 0 ? (
        <label>
          Version
          <select value={selectedArtifactId ?? ''} onChange={(event) => setSelectedArtifactId(event.target.value)}>
            {artifacts.data.items.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>
                {formatDateTime(artifact.created_at)}{artifact.is_current ? ' · current' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {selectedArtifact ? (
        <>
          <ArtifactRenderer artifact={selectedArtifact} />
          <CitationPanel artifact={selectedArtifact} />
          <div className="artifact-actions">
            <button type="button" className="secondary-button" onClick={() => exportSelected('markdown')}>Markdown</button>
            <button type="button" className="secondary-button" onClick={copyMarkdown}>Copy</button>
            <button type="button" className="secondary-button" onClick={() => exportSelected('pdf')}>PDF</button>
            {copyStatus ? <span className="muted">{copyStatus}</span> : null}
          </div>
          {exportMutation.error ? <ErrorNotice error={exportMutation.error} /> : null}
        </>
      ) : (
        <p className="muted">Generate an artifact to review versions, citations, and exports.</p>
      )}
    </section>
  )
}

function ArtifactRenderer({ artifact }: { artifact: GeneratedArtifact }) {
  if (artifact.kind === 'COVER_LETTER') {
    const parsed = coverLetterContentSchema.safeParse(artifact.content)
    if (!parsed.success) {
      return <InvalidArtifact />
    }
    return (
      <article className="artifact-rendered">
        {parsed.data.subject ? <h4>{parsed.data.subject}</h4> : null}
        <p className="artifact-meta">{parsed.data.language} / {parsed.data.format}</p>
        <div className="artifact-text">{parsed.data.body}</div>
      </article>
    )
  }

  if (artifact.kind === 'CV_BULLET_SUGGESTIONS') {
    const parsed = cvBulletSuggestionsContentSchema.safeParse(artifact.content)
    if (!parsed.success) {
      return <InvalidArtifact />
    }
    return (
      <article className="artifact-rendered">
        <div className="cv-diff-list">
          {parsed.data.suggestions.map((suggestion) => (
            <div className="cv-diff-row" key={`${suggestion.experience_ref}-${suggestion.suggested}`}>
              <div>
                <span>Original</span>
                <p>{suggestion.original || 'No original bullet supplied.'}</p>
              </div>
              <div>
                <span>Suggested</span>
                <p>{suggestion.suggested}</p>
              </div>
              <p className="muted">{suggestion.reason}</p>
            </div>
          ))}
        </div>
        <FitPointList title="Emphasize" points={parsed.data.emphasize} />
        <FitPointList title="Do not pretend" points={parsed.data.do_not_pretend} />
      </article>
    )
  }

  if (artifact.kind === 'PORTAL_ANSWER') {
    const parsed = portalAnswerContentSchema.safeParse(artifact.content)
    if (!parsed.success) {
      return <InvalidArtifact />
    }
    return (
      <article className="artifact-rendered">
        <h4>{parsed.data.question}</h4>
        <p className="artifact-meta">{parsed.data.language}</p>
        <div className="artifact-text">{parsed.data.answer}</div>
      </article>
    )
  }

  return <InvalidArtifact />
}

function CitationPanel({ artifact }: { artifact: GeneratedArtifact }) {
  if (artifact.citations.length === 0) {
    return null
  }
  return (
    <section className="citation-panel">
      <h4>Citations</h4>
      <div className="citation-list">
        {artifact.citations.map((citation) => (
          <article
            className={citation.status === 'UNSUPPORTED' ? 'citation-row citation-unsupported' : 'citation-row'}
            key={`${citation.claim}-${citation.evidence_ref ?? 'none'}`}
          >
            <strong>{citation.status}</strong>
            <p>{citation.claim}</p>
            <span>{citation.evidence_ref ?? 'No evidence'}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function InvalidArtifact() {
  return <div className="notice notice-error">Artifact content did not match the expected shape.</div>
}

function JobSnapshot({ application }: { application: Application }) {
  const snapshot = application.job_snapshot
  const title = stringAt(snapshot, ['text', 'title']) ?? application.job_title
  const company = application.company ?? stringAt(snapshot, ['companyCleaned']) ?? stringAt(snapshot, ['company'])
  const place = stringAt(snapshot, ['addresses', 0, 'place'])
  const link = stringAt(snapshot, ['link'])

  return (
    <section className="workspace-card job-snapshot">
      <div>
        <p className="eyebrow">Job snapshot</p>
        <h3>{title}</h3>
        <p className="muted">{[company, place].filter(Boolean).join(' · ') || 'Company/location not listed'}</p>
      </div>
      <div className="snapshot-actions">
        <span className="status-pill">{application.status}</span>
        {link ? <a href={link} target="_blank" rel="noreferrer">Original posting →</a> : null}
      </div>
    </section>
  )
}

function FitPointList({ title, points }: { title: string; points: string[] }) {
  if (points.length === 0) {
    return null
  }
  return (
    <div className="fit-point-list">
      <h4>{title}</h4>
      <ul>
        {points.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>
    </div>
  )
}

function ErrorNotice({ error }: { error: Error }) {
  return (
    <div className="notice notice-error" role="alert">
      {error instanceof ApiError ? `${error.status} ${error.code}: ${error.message}` : error.message}
    </div>
  )
}

function briefToForm(brief: ApplicationBrief): BriefForm {
  return {
    target_angle: brief.target_angle ?? '',
    emphasize: brief.emphasize,
    avoid: brief.avoid ?? '',
    tone: brief.tone ?? 'direct, professional',
    language: brief.language,
    company_motivation: brief.company_motivation ?? '',
    user_notes: brief.user_notes ?? '',
    free_emphasis: '',
  }
}

function formToBriefRequest(form: BriefForm) {
  return {
    target_angle: nullIfEmpty(form.target_angle),
    emphasize: form.emphasize,
    avoid: nullIfEmpty(form.avoid),
    tone: nullIfEmpty(form.tone),
    language: form.language,
    company_motivation: nullIfEmpty(form.company_motivation),
    user_notes: nullIfEmpty(form.user_notes),
  }
}

function effectiveStatus(requirement: RequirementCheck) {
  return requirement.user_override ?? requirement.status
}

function stringAt(source: unknown, path: Array<string | number>): string | null {
  const value = valueAt(source, path)
  return typeof value === 'string' && value.trim() ? value : null
}

function valueAt(source: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof key === 'number' && Array.isArray(current)) {
      return current[key]
    }
    if (typeof key === 'string' && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, source)
}

function nullIfEmpty(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
