import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  ApiError,
  useApplicationBriefQuery,
  useApplicationQuery,
  useApplicationsQuery,
  useFitQuery,
  useProfileQuery,
  useRunFitMutation,
  useUpdateApplicationBriefMutation,
  useUpdateRequirementOverrideMutation,
  type Application,
  type ApplicationBrief,
  type FitResponse,
  type Profile,
  type RequirementCheck,
  type RequirementStatus,
} from '../api'

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

type EvidenceChip = {
  id: string
  ref: string
  label: string
  detail: string
  kind: 'skill' | 'experience' | 'project'
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

const requirementStatuses: RequirementStatus[] = ['HAVE', 'PARTIAL', 'MISSING']

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
      {applications.isPending ? <p className="muted">Loading applications...</p> : null}
      {applications.isError ? <ErrorNotice error={applications.error} /> : null}
      <div className="workspace-list">
        {applications.data?.items.map((application) => (
          <Link className="workspace-list-item" to={`/workspace/${application.id}`} key={application.id}>
            <strong>{application.job_title}</strong>
            <span>{application.company ?? 'Company not listed'}</span>
          </Link>
        ))}
      </div>
      {applications.data?.items.length === 0 ? (
        <p className="muted">Saved jobs will appear here after you add them from Search.</p>
      ) : null}
    </section>
  )
}

function WorkspaceDetail({ applicationId }: { applicationId: string }) {
  const application = useApplicationQuery(applicationId)
  const profile = useProfileQuery()
  const brief = useApplicationBriefQuery(applicationId)
  const fit = useFitQuery(applicationId)
  const updateBrief = useUpdateApplicationBriefMutation(applicationId)
  const runFit = useRunFitMutation(applicationId)
  const updateRequirement = useUpdateRequirementOverrideMutation(applicationId)
  const [form, setForm] = useState<BriefForm>(emptyBriefForm)

  useEffect(() => {
    if (brief.data) {
      setForm(briefToForm(brief.data))
    }
  }, [brief.data])

  const evidence = useMemo(() => evidenceChips(profile.data), [profile.data])
  const jobTitle = stringAt(application.data?.job_snapshot, ['text', 'title']) ?? application.data?.job_title ?? ''
  const company = application.data?.company ?? stringAt(application.data?.job_snapshot, ['companyCleaned']) ?? ''

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
        <Link className="nav-link" to="/search">Back to search</Link>
      </div>

      {application.isPending ? <p className="muted">Loading application...</p> : null}
      {application.isError ? <ErrorNotice error={application.error} /> : null}
      {brief.isError ? <ErrorNotice error={brief.error} /> : null}
      {profile.isError ? <ErrorNotice error={profile.error} /> : null}

      {application.data ? <JobSnapshot application={application.data} /> : null}

      <div className="workspace-grid">
        <div className="workspace-main">
          <MissingInfoPrompts
            company={company}
            jobTitle={jobTitle}
            fit={fit.data}
            form={form}
            setForm={setForm}
          />
          <BriefBuilder
            form={form}
            setForm={setForm}
            evidence={evidence}
            fit={fit.data}
            saving={updateBrief.isPending}
            saveError={updateBrief.error}
            onSubmit={saveBrief}
          />
          <FitPanel
            fit={fit.data}
            fitError={fit.error}
            running={runFit.isPending}
            runError={runFit.error}
            onRun={() => runFit.mutate()}
          />
        </div>

        <aside className="workspace-side">
          <RequirementsPanel
            requirements={fit.data?.requirements ?? []}
            evidence={evidence}
            onOverride={(requirementId, userOverride) =>
              updateRequirement.mutate({ requirementId, userOverride })
            }
            pending={updateRequirement.isPending}
            error={updateRequirement.error}
          />
          <MatchedEvidence evidence={evidence} requirements={fit.data?.requirements ?? []} />
        </aside>
      </div>
    </section>
  )
}

function JobSnapshot({ application }: { application: Application }) {
  const snapshot = application.job_snapshot
  const title = stringAt(snapshot, ['text', 'title']) ?? application.job_title
  const company = application.company ?? stringAt(snapshot, ['companyCleaned']) ?? stringAt(snapshot, ['company'])
  const place = stringAt(snapshot, ['addresses', 0, 'place'])
  const link = stringAt(snapshot, ['link'])
  const requirements = stringArrayAt(snapshot, ['text', 'requirements'])

  return (
    <section className="workspace-card job-snapshot">
      <div>
        <p className="eyebrow">Job snapshot</p>
        <h3>{title}</h3>
        <p className="muted">{[company, place].filter(Boolean).join(' - ') || 'Company/location not listed'}</p>
      </div>
      <div className="snapshot-actions">
        <span className="status-pill">{application.status}</span>
        {link ? <a href={link} target="_blank" rel="noreferrer">Original posting</a> : null}
      </div>
      {requirements.length > 0 ? (
        <ul className="snapshot-requirements">
          {requirements.slice(0, 4).map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function MissingInfoPrompts({
  company,
  jobTitle,
  fit,
  form,
  setForm,
}: {
  company: string
  jobTitle: string
  fit: FitResponse | undefined
  form: BriefForm
  setForm: (updater: (current: BriefForm) => BriefForm) => void
}) {
  const prompts = [
    {
      key: 'motivation',
      label: 'Add company motivation',
      hidden: form.company_motivation.trim().length > 0 || !company,
      apply: () =>
        setForm((current) => ({
          ...current,
          company_motivation: `I am interested in ${company} because of the product, engineering scope, and role context.`,
        })),
    },
    {
      key: 'angle',
      label: 'Use suggested angle',
      hidden: form.target_angle.trim().length > 0 || !fit?.fit.suggested_angle,
      apply: () => setForm((current) => ({ ...current, target_angle: fit?.fit.suggested_angle ?? current.target_angle })),
    },
    {
      key: 'role-angle',
      label: 'Frame for this role',
      hidden: form.target_angle.trim().length > 0 || !jobTitle,
      apply: () =>
        setForm((current) => ({
          ...current,
          target_angle: `${jobTitle} with emphasis on the strongest verified profile evidence.`,
        })),
    },
    {
      key: 'risk',
      label: 'Add honest risk note',
      hidden: form.avoid.trim().length > 0 || (fit?.fit.do_not_claim.length ?? 0) === 0,
      apply: () =>
        setForm((current) => ({
          ...current,
          avoid: `Do not overstate: ${fit?.fit.do_not_claim.join(', ') ?? ''}`,
        })),
    },
  ].filter((prompt) => !prompt.hidden)

  if (prompts.length === 0) {
    return null
  }

  return (
    <section className="workspace-card prompt-card">
      <h3>Missing info prompts</h3>
      <div className="prompt-actions">
        {prompts.map((prompt) => (
          <button type="button" className="secondary-button" key={prompt.key} onClick={prompt.apply}>
            {prompt.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function BriefBuilder({
  form,
  setForm,
  evidence,
  fit,
  saving,
  saveError,
  onSubmit,
}: {
  form: BriefForm
  setForm: (value: BriefForm) => void
  evidence: EvidenceChip[]
  fit: FitResponse | undefined
  saving: boolean
  saveError: Error | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const angleSuggestions = [
    fit?.fit.suggested_angle,
    'Backend/platform specialist',
    'Fast-learning generalist',
    'Domain-focused engineer',
  ].filter((value): value is string => Boolean(value))

  function toggleEmphasis(label: string) {
    setForm({
      ...form,
      emphasize: form.emphasize.includes(label)
        ? form.emphasize.filter((item) => item !== label)
        : [...form.emphasize, label],
    })
  }

  function addFreeEmphasis() {
    const value = form.free_emphasis.trim()
    if (!value || form.emphasize.includes(value)) {
      return
    }
    setForm({ ...form, emphasize: [...form.emphasize, value], free_emphasis: '' })
  }

  return (
    <form className="workspace-card brief-builder" onSubmit={onSubmit}>
      <div className="card-heading">
        <h3>Application brief</h3>
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save brief'}</button>
      </div>
      <div className="chip-row">
        {angleSuggestions.map((angle) => (
          <button type="button" className="secondary-button" key={angle} onClick={() => setForm({ ...form, target_angle: angle })}>
            {angle}
          </button>
        ))}
      </div>
      <label>
        Target angle
        <textarea
          value={form.target_angle}
          rows={3}
          onChange={(event) => setForm({ ...form, target_angle: event.target.value })}
        />
      </label>
      <div>
        <h4>Evidence to emphasize</h4>
        <div className="evidence-chip-grid">
          {evidence.map((item) => (
            <button
              type="button"
              className={form.emphasize.includes(item.label) ? 'evidence-chip evidence-chip-active' : 'evidence-chip'}
              key={item.ref}
              onClick={() => toggleEmphasis(item.label)}
            >
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="preset-form">
        <input
          value={form.free_emphasis}
          placeholder="Add emphasis"
          onChange={(event) => setForm({ ...form, free_emphasis: event.target.value })}
        />
        <button type="button" className="secondary-button" onClick={addFreeEmphasis}>Add</button>
      </div>
      {form.emphasize.length > 0 ? (
        <div className="selected-chip-row">
          {form.emphasize.map((item) => (
            <button type="button" className="selected-chip" key={item} onClick={() => toggleEmphasis(item)}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <div className="field-grid">
        <label>
          Tone
          <input value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value })} />
        </label>
        <label>
          Language
          <select
            value={form.language}
            onChange={(event) => setForm({ ...form, language: event.target.value as BriefForm['language'] })}
          >
            <option value="DE">DE</option>
            <option value="EN">EN</option>
          </select>
        </label>
      </div>
      <label>
        Why this company?
        <textarea
          value={form.company_motivation}
          rows={4}
          onChange={(event) => setForm({ ...form, company_motivation: event.target.value })}
        />
      </label>
      <label>
        Avoid
        <textarea value={form.avoid} rows={3} onChange={(event) => setForm({ ...form, avoid: event.target.value })} />
      </label>
      <label>
        User notes
        <textarea
          value={form.user_notes}
          rows={4}
          onChange={(event) => setForm({ ...form, user_notes: event.target.value })}
        />
      </label>
      {saveError ? <ErrorNotice error={saveError} /> : null}
    </form>
  )
}

function FitPanel({
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

  return (
    <section className="workspace-card fit-panel">
      <div className="card-heading">
        <h3>Fit analysis</h3>
        <button type="button" onClick={onRun} disabled={running}>{running ? 'Running...' : 'Run fit'}</button>
      </div>
      {runError ? <ErrorNotice error={runError} /> : null}
      {fitError && !noFitYet ? <ErrorNotice error={fitError} /> : null}
      {noFitYet && !fit ? <p className="muted">Run fit to create the analysis and requirements checklist.</p> : null}
      {fit ? (
        <>
          <p>{fit.fit.summary}</p>
          <FitPointList title="Strong matches" points={fit.fit.strong_matches.map((item) => item.point)} />
          <FitPointList title="Weak matches" points={fit.fit.weak_matches.map((item) => item.point)} />
          <FitPointList title="Unknowns" points={fit.fit.unknowns.map((item) => item.point)} />
          <FitPointList title="Do not claim" points={fit.fit.do_not_claim} />
          {fit.fit.risks_to_address.length > 0 ? (
            <div className="risk-list">
              <h4>Risks to address honestly</h4>
              {fit.fit.risks_to_address.map((risk) => (
                <article key={`${risk.risk}-${risk.honest_framing}`}>
                  <strong>{risk.risk}</strong>
                  <p>{risk.honest_framing}</p>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function RequirementsPanel({
  requirements,
  evidence,
  onOverride,
  pending,
  error,
}: {
  requirements: RequirementCheck[]
  evidence: EvidenceChip[]
  onOverride: (requirementId: string, userOverride: RequirementStatus | null) => void
  pending: boolean
  error: Error | null
}) {
  return (
    <section className="workspace-card">
      <h3>Requirements</h3>
      {requirements.length === 0 ? <p className="muted">Requirements appear after fit runs.</p> : null}
      <div className="requirements-list">
        {requirements.map((requirement) => (
          <article className="requirement-row" key={requirement.id}>
            <div>
              <strong>{requirement.requirement}</strong>
              <span className={`requirement-status status-${effectiveStatus(requirement).toLowerCase()}`}>
                {effectiveStatus(requirement)}
              </span>
            </div>
            <EvidenceRefs refs={requirement.evidence} evidence={evidence} />
            <label>
              Override
              <select
                value={requirement.user_override ?? ''}
                disabled={pending}
                onChange={(event) =>
                  onOverride(
                    requirement.id,
                    event.target.value === '' ? null : (event.target.value as RequirementStatus),
                  )
                }
              >
                <option value="">Use analysis</option>
                {requirementStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
      {error ? <ErrorNotice error={error} /> : null}
    </section>
  )
}

function MatchedEvidence({ evidence, requirements }: { evidence: EvidenceChip[]; requirements: RequirementCheck[] }) {
  const matchedRefs = new Set(requirements.flatMap((requirement) => requirement.evidence))
  const sorted = [...evidence].sort((a, b) => Number(matchedRefs.has(b.ref)) - Number(matchedRefs.has(a.ref)))

  return (
    <section className="workspace-card">
      <h3>Matched evidence</h3>
      {sorted.length === 0 ? <p className="muted">Add profile skills, experiences, or projects to use as evidence.</p> : null}
      <div className="matched-evidence-list">
        {sorted.map((item) => (
          <article className={matchedRefs.has(item.ref) ? 'matched-evidence matched-evidence-active' : 'matched-evidence'} key={item.ref}>
            <strong>{item.label}</strong>
            <span>{item.kind} - {item.detail}</span>
          </article>
        ))}
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
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  )
}

function EvidenceRefs({ refs, evidence }: { refs: string[]; evidence: EvidenceChip[] }) {
  if (refs.length === 0) {
    return <p className="muted">No cited profile evidence.</p>
  }

  return (
    <div className="evidence-ref-list">
      {refs.map((ref) => {
        const item = evidence.find((candidate) => candidate.ref === ref)
        return <span key={ref}>{item ? item.label : ref}</span>
      })}
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

function evidenceChips(profile: Profile | undefined): EvidenceChip[] {
  if (!profile) {
    return []
  }

  return [
    ...profile.skills.map((skill) => ({
      id: skill.id,
      ref: `skill:${skill.id}`,
      label: skill.name,
      detail: [skill.kind, skill.level].filter(Boolean).join(' / '),
      kind: 'skill' as const,
    })),
    ...profile.experiences.map((experience) => ({
      id: experience.id,
      ref: `experience:${experience.id}`,
      label: experience.title,
      detail: [experience.company, experience.tech.slice(0, 3).join(', ')].filter(Boolean).join(' / '),
      kind: 'experience' as const,
    })),
    ...profile.projects.map((project) => ({
      id: project.id,
      ref: `project:${project.id}`,
      label: project.name,
      detail: [project.role, project.tech.slice(0, 3).join(', ')].filter(Boolean).join(' / '),
      kind: 'project' as const,
    })),
  ]
}

function effectiveStatus(requirement: RequirementCheck) {
  return requirement.user_override ?? requirement.status
}

function stringAt(source: unknown, path: Array<string | number>): string | null {
  const value = valueAt(source, path)
  return typeof value === 'string' && value.trim() ? value : null
}

function stringArrayAt(source: unknown, path: Array<string | number>): string[] {
  const value = valueAt(source, path)
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
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
