import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  useApplicationQuery,
  useChecklistQuery,
  useCommsQuery,
  useCreateCommsMutation,
  useDeleteCommsMutation,
  usePatchApplicationMutation,
  useUpdateChecklistMutation,
  type ApplicationStatus,
  type CommsDirection,
  type CommsKind,
  type PackageChecklist,
  type PackageChecklistItems,
  type PackageChecklistRequest,
  type WorkPermitStatus,
} from '../api'

type StatusNudge = { status: ApplicationStatus; label: string }

const INTERVIEW_WORDS = ['interview', 'vorstellungsgespräch', 'gespräch', 'einladung', 'kennenlernen', 'meeting', 'call with']
const REJECT_WORDS = ['rejection', 'rejected', 'unfortunately', 'absage', 'leider', 'not move forward', 'other candidates']
const OFFER_WORDS = ['offer', 'angebot', 'vertrag', 'contract', 'we are pleased to offer']

function detectStatusNudge(text: string, current: ApplicationStatus): StatusNudge | null {
  const lower = text.toLowerCase()
  const has = (words: string[]) => words.some((word) => lower.includes(word))
  if (has(OFFER_WORDS) && current !== 'OFFER') return { status: 'OFFER', label: 'Move to Offer?' }
  if (has(INTERVIEW_WORDS) && current !== 'INTERVIEW' && current !== 'OFFER') return { status: 'INTERVIEW', label: 'Move to Interviewing?' }
  if (has(REJECT_WORDS) && current !== 'REJECTED') return { status: 'REJECTED', label: 'Move to Rejected?' }
  return null
}

type ChecklistForm = {
  salary_expectation: string
  earliest_start_date: string
  language_level_required: string
  language_level_user: string
  work_permit_status: WorkPermitStatus
  certificates_ready: boolean
  cover_letter_required: boolean
  items: PackageChecklistItems
  notes: string
}

type CommsForm = {
  kind: CommsKind
  direction: CommsDirection
  subject: string
  body: string
}

const itemLabels: Array<{ key: keyof PackageChecklistItems; label: string }> = [
  { key: 'cv_reviewed', label: 'CV reviewed' },
  { key: 'cover_letter', label: 'Cover letter' },
  { key: 'requirements_checked', label: 'Requirements checked' },
  { key: 'salary_set', label: 'Salary set' },
  { key: 'start_date_set', label: 'Start date set' },
  { key: 'language_ok', label: 'Language OK' },
  { key: 'work_permit_ok', label: 'Work permit OK' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'portal_answers', label: 'Portal answers' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'followup_set', label: 'Follow-up set' },
]

const workPermitStatuses: WorkPermitStatus[] = [
  'UNKNOWN',
  'NOT_RELEVANT',
  'EU_CITIZEN',
  'HAVE_PERMIT',
  'NEED_SPONSORSHIP',
]

const emptyCommsForm: CommsForm = {
  kind: 'NOTE',
  direction: 'NONE',
  subject: '',
  body: '',
}

export function ChecklistSummary({ applicationId }: { applicationId: string }) {
  const checklist = useChecklistQuery(applicationId)

  if (checklist.isPending) {
    return <p className="muted">Checklist loading...</p>
  }
  if (checklist.isError) {
    return <InlineError error={checklist.error} />
  }

  const done = completedItems(checklist.data)
  const total = itemLabels.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="card-progress">
      <div className="card-progress-bar" aria-label={`${done} of ${total} ready`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="card-progress-meta">
        <span className="muted">{done}/{total} ready</span>
        {checklist.data.language_level_required ? (
          <span className={checklist.data.items.language_ok ? 'mini-pill mini-pill-ok' : 'mini-pill mini-pill-warn'}>
            {checklist.data.language_level_user || '?'} / {checklist.data.language_level_required}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function PackageChecklistPanel({ applicationId, compact = false }: { applicationId: string; compact?: boolean }) {
  const checklist = useChecklistQuery(applicationId)
  const updateChecklist = useUpdateChecklistMutation(applicationId)
  const [form, setForm] = useState<ChecklistForm | null>(null)

  useEffect(() => {
    if (checklist.data) {
      setForm(checklistToForm(checklist.data))
    }
  }, [checklist.data])

  function saveChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) {
      return
    }
    updateChecklist.mutate(formToRequest(form))
  }

  if (checklist.isPending) {
    return <section className="workspace-card"><p className="muted">Loading checklist...</p></section>
  }
  if (checklist.isError) {
    return <section className="workspace-card"><InlineError error={checklist.error} /></section>
  }
  if (!form) {
    return null
  }

  return (
    <section className={compact ? 'board-detail-card checklist-panel' : 'workspace-card checklist-panel'}>
      <div className="card-heading">
        <h3>Package checklist</h3>
        <span className="status-pill">{completedItems(checklist.data)}/{itemLabels.length}</span>
      </div>
      <form className="checklist-form" onSubmit={saveChecklist}>
        <div className="field-grid">
          <label>
            Salary expectation
            <input
              value={form.salary_expectation}
              onChange={(event) => setForm({ ...form, salary_expectation: event.target.value })}
            />
          </label>
          <label>
            Earliest start
            <input
              type="date"
              value={form.earliest_start_date}
              onChange={(event) => setForm({ ...form, earliest_start_date: event.target.value })}
            />
          </label>
          <label>
            Required German
            <input
              value={form.language_level_required}
              onChange={(event) => setForm({ ...form, language_level_required: event.target.value })}
            />
          </label>
          <label>
            Your German
            <input
              value={form.language_level_user}
              onChange={(event) => setForm({ ...form, language_level_user: event.target.value })}
            />
          </label>
          <label>
            Work permit
            <select
              value={form.work_permit_status}
              onChange={(event) => setForm({ ...form, work_permit_status: event.target.value as WorkPermitStatus })}
            >
              {workPermitStatuses.map((status) => (
                <option key={status} value={status}>{displayValue(status)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="checklist-toggles">
          <label>
            <input
              type="checkbox"
              checked={form.certificates_ready}
              onChange={(event) => setForm({ ...form, certificates_ready: event.target.checked })}
            />
            Certificates ready
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.cover_letter_required}
              onChange={(event) => setForm({ ...form, cover_letter_required: event.target.checked })}
            />
            Cover letter required
          </label>
        </div>
        <div className="checklist-items">
          {itemLabels.map((item) => (
            <label key={item.key}>
              <input
                type="checkbox"
                checked={form.items[item.key]}
                onChange={(event) =>
                  setForm({ ...form, items: { ...form.items, [item.key]: event.target.checked } })
                }
              />
              {item.label}
            </label>
          ))}
        </div>
        <label>
          Notes
          <textarea value={form.notes} rows={3} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <button type="submit" disabled={updateChecklist.isPending}>
          {updateChecklist.isPending ? 'Saving...' : 'Save checklist'}
        </button>
      </form>
      {updateChecklist.isError ? <InlineError error={updateChecklist.error} /> : null}
    </section>
  )
}

export function CommsLogPanel({ applicationId, compact = false }: { applicationId: string; compact?: boolean }) {
  const comms = useCommsQuery(applicationId)
  const application = useApplicationQuery(applicationId)
  const createComms = useCreateCommsMutation(applicationId)
  const deleteComms = useDeleteCommsMutation(applicationId)
  const patch = usePatchApplicationMutation()
  const [form, setForm] = useState<CommsForm>(emptyCommsForm)
  const [nudge, setNudge] = useState<StatusNudge | null>(null)

  function submitComms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = `${form.subject} ${form.body}`
    const current = application.data?.status ?? 'SAVED'
    createComms.mutate(
      {
        kind: form.kind,
        direction: form.direction,
        subject: nullIfEmpty(form.subject),
        body: form.body.trim(),
      },
      {
        onSuccess: () => {
          setNudge(detectStatusNudge(text, current))
          setForm(emptyCommsForm)
        },
      },
    )
  }

  function acceptNudge() {
    if (!nudge) return
    patch.mutate({ id: applicationId, input: { status: nudge.status } }, { onSuccess: () => setNudge(null) })
  }

  const entries = useMemo(() => comms.data?.items ?? [], [comms.data])

  return (
    <section className={compact ? 'board-detail-card comms-panel' : 'workspace-card comms-panel'}>
      <h3>Comms log</h3>
      <form className="comms-form" onSubmit={submitComms}>
        <div className="field-grid">
          <label>
            Type
            <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as CommsKind })}>
              <option value="NOTE">Note</option>
              <option value="EMAIL">Email</option>
              <option value="CALL">Call</option>
              <option value="EVENT">Event</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={form.direction}
              onChange={(event) => setForm({ ...form, direction: event.target.value as CommsDirection })}
            >
              <option value="NONE">None</option>
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>
          </label>
        </div>
        <label>
          Subject
          <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
        </label>
        <label>
          Body
          <textarea value={form.body} rows={4} onChange={(event) => setForm({ ...form, body: event.target.value })} />
        </label>
        <button type="submit" disabled={createComms.isPending || form.body.trim().length === 0}>
          {createComms.isPending ? 'Adding...' : 'Add entry'}
        </button>
      </form>
      {createComms.isError ? <InlineError error={createComms.error} /> : null}
      {nudge ? (
        <div className="comms-nudge">
          <span>This looks like an update. {nudge.label}</span>
          <div className="row-actions">
            <button type="button" onClick={acceptNudge} disabled={patch.isPending}>Yes, move</button>
            <button type="button" className="secondary-button" onClick={() => setNudge(null)}>Dismiss</button>
          </div>
        </div>
      ) : null}
      {comms.isPending ? <p className="muted">Loading comms...</p> : null}
      {comms.isError ? <InlineError error={comms.error} /> : null}
      <div className="comms-timeline">
        {entries.map((entry) => (
          <article className="comms-entry" key={entry.id}>
            <div>
              <strong>{entry.subject || displayValue(entry.kind)}</strong>
              <span>{displayValue(entry.direction)} / {formatDateTime(entry.occurred_at)}</span>
            </div>
            <p>{entry.body}</p>
            <button type="button" className="secondary-button" onClick={() => deleteComms.mutate(entry.id)}>
              Delete
            </button>
          </article>
        ))}
      </div>
      {entries.length === 0 && !comms.isPending ? <p className="muted">No comms logged yet.</p> : null}
      {deleteComms.isError ? <InlineError error={deleteComms.error} /> : null}
    </section>
  )
}

function checklistToForm(checklist: PackageChecklist): ChecklistForm {
  return {
    salary_expectation: checklist.salary_expectation ?? '',
    earliest_start_date: checklist.earliest_start_date ?? '',
    language_level_required: checklist.language_level_required ?? '',
    language_level_user: checklist.language_level_user ?? '',
    work_permit_status: checklist.work_permit_status,
    certificates_ready: checklist.certificates_ready,
    cover_letter_required: checklist.cover_letter_required,
    items: checklist.items,
    notes: checklist.notes ?? '',
  }
}

function formToRequest(form: ChecklistForm): PackageChecklistRequest {
  return {
    salary_expectation: nullIfEmpty(form.salary_expectation),
    earliest_start_date: nullIfEmpty(form.earliest_start_date),
    language_level_required: nullIfEmpty(form.language_level_required),
    language_level_user: nullIfEmpty(form.language_level_user),
    work_permit_status: form.work_permit_status,
    certificates_ready: form.certificates_ready,
    cover_letter_required: form.cover_letter_required,
    items: form.items,
    notes: nullIfEmpty(form.notes),
  }
}

function completedItems(checklist: PackageChecklist) {
  return Object.values(checklist.items).filter(Boolean).length
}

function InlineError({ error }: { error: Error }) {
  return (
    <div className="notice notice-error" role="alert">
      {error instanceof ApiError ? `${error.status} ${error.code}: ${error.message}` : error.message}
    </div>
  )
}

function nullIfEmpty(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function displayValue(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
