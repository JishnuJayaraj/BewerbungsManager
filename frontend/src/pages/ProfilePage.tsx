import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  useCreateEducationMutation,
  useCreateExperienceMutation,
  useCreateProjectMutation,
  useCreateSkillMutation,
  useDeleteEducationMutation,
  useDeleteExperienceMutation,
  useDeleteProjectMutation,
  useDeleteSkillMutation,
  useEnrichApplyMutation,
  useEnrichQuestionsMutation,
  useImproveFieldMutation,
  useParseCvMutation,
  useProfileQuery,
  useUpdateEducationMutation,
  useUpdateExperienceMutation,
  useUpdateProfileMutation,
  useUpdateProjectMutation,
  type EnrichAnswer,
  type EnrichQuestion,
  type Education,
  type Experience,
  type Profile,
  type Project,
  type Skill,
} from '../api'
import { profileStrength, type ProfileGap } from '../lib/profileStrength'

export function ProfilePage() {
  const profile = useProfileQuery()
  const [enrichOpen, setEnrichOpen] = useState(false)

  const data = profile.data
  const strength = profileStrength(data)

  function jumpTo(gap: ProfileGap) {
    if (gap.ai) {
      setEnrichOpen(true)
      return
    }
    document.getElementById(gap.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <div className="section-heading profile-hero">
        <div>
          <p className="eyebrow">Profile</p>
          <h2 id="profile-title">Your profile</h2>
          <p className="section-copy">The richer this is, the sharper your fit checks and tailored materials.</p>
        </div>
        <button type="button" onClick={() => setEnrichOpen(true)}>✦ Enrich with AI</button>
      </div>

      {profile.isPending ? <p className="muted loading-pulse">Loading profile…</p> : null}
      {profile.isError ? <ErrorNotice error={profile.error} /> : null}
      {data?.parse_warning ? <div className="notice notice-error">{data.parse_warning}</div> : null}

      {data ? (
        <>
          <StrengthCard strength={strength} onJump={jumpTo} onEnrich={() => setEnrichOpen(true)} />
          <CvImport hasData={data.skills.length > 0 || data.experiences.length > 0} />
          <IdentityCard profile={data} />
          <ChipSection
            id="skills"
            title="Skills"
            hint="Your hard skills and tools. Type one and press Enter."
            kind="IT_SKILL"
            skills={data.skills.filter((s) => s.kind === 'IT_SKILL' || s.kind === 'SOFT_SKILL')}
          />
          <LanguagesSection languages={data.skills.filter((s) => s.kind === 'LANGUAGE')} />
          <ChipSection
            id="certs"
            title="Certifications"
            hint="Credentials worth showing. Type one and press Enter."
            kind="CERT"
            skills={data.skills.filter((s) => s.kind === 'CERT')}
          />
          <ExperienceSection experiences={data.experiences} />
          <EducationSection education={data.education} />
          <ProjectSection projects={data.projects} />
          <LinksSection links={data.links} />
        </>
      ) : null}

      {enrichOpen ? <EnrichModal onClose={() => setEnrichOpen(false)} hasProfile={Boolean(data)} /> : null}
    </section>
  )
}

/* ── Strength ─────────────────────────────────────────── */

function StrengthCard({
  strength,
  onJump,
  onEnrich,
}: {
  strength: ReturnType<typeof profileStrength>
  onJump: (gap: ProfileGap) => void
  onEnrich: () => void
}) {
  const tone = strength.pct >= 80 ? 'good' : strength.pct >= 50 ? 'mid' : 'low'
  return (
    <section className={`strength-card strength-${tone}`}>
      <div className="strength-meter-wrap">
        <div className="strength-head">
          <strong>Profile strength</strong>
          <span>{strength.pct}%</span>
        </div>
        <div className="strength-bar"><span style={{ width: `${strength.pct}%` }} /></div>
      </div>
      {strength.gaps.length > 0 ? (
        <div className="strength-gaps">
          <span className="muted">Boost it:</span>
          {strength.gaps.slice(0, 4).map((gap) => (
            <button type="button" key={gap.key} className="gap-chip" onClick={() => onJump(gap)}>
              {gap.ai ? '✦ ' : '+ '}{gap.label}
            </button>
          ))}
          <button type="button" className="link-toggle" onClick={onEnrich}>Ask AI what's missing →</button>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>✓ Looking strong. Keep it fresh as you go.</p>
      )}
    </section>
  )
}

/* ── CV import (one-time, collapsed) ──────────────────── */

function CvImport({ hasData }: { hasData: boolean }) {
  const parseCv = useParseCvMutation()
  const [cvText, setCvText] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    parseCv.mutate(cvText)
  }

  return (
    <details className="profile-card profile-accordion" open={!hasData}>
      <summary><span>📄 Import from CV</span><span className="muted">{hasData ? 'replaces your profile' : 'fastest way to start'}</span></summary>
      <form className="profile-accordion-body" onSubmit={submit}>
        <p className="muted">Paste your CV — the assistant extracts skills, experience, education and more. You can edit everything after.</p>
        <textarea value={cvText} onChange={(event) => setCvText(event.target.value)} rows={7} placeholder="Paste CV text…" />
        <div className="row-actions">
          <button type="submit" disabled={parseCv.isPending || cvText.trim().length === 0}>
            {parseCv.isPending ? 'Parsing…' : 'Parse CV'}
          </button>
          {parseCv.isError ? <ErrorNotice error={parseCv.error} /> : null}
        </div>
      </form>
    </details>
  )
}

/* ── Identity ─────────────────────────────────────────── */

function IdentityCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfileMutation()
  const improve = useImproveFieldMutation()
  const [full_name, setFullName] = useState(profile.full_name ?? '')
  const [headline, setHeadline] = useState(profile.headline ?? '')
  const [seniority, setSeniority] = useState(profile.seniority ?? '')
  const [years, setYears] = useState(profile.years_exp === null ? '' : String(profile.years_exp))
  const [summary, setSummary] = useState(profile.summary ?? '')
  const [roles, setRoles] = useState(targetRolesText(profile))
  const [suggestion, setSuggestion] = useState<string | null>(null)

  useEffect(() => {
    setFullName(profile.full_name ?? '')
    setHeadline(profile.headline ?? '')
    setSeniority(profile.seniority ?? '')
    setYears(profile.years_exp === null ? '' : String(profile.years_exp))
    setSummary(profile.summary ?? '')
    setRoles(targetRolesText(profile))
  }, [profile])

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    update.mutate({
      full_name: nullIfEmpty(full_name),
      headline: nullIfEmpty(headline),
      seniority: nullIfEmpty(seniority),
      years_exp: years.trim() === '' ? null : Number(years),
      summary: nullIfEmpty(summary),
      preferences: { ...(profile.preferences ?? {}), target_roles: splitComma(roles) },
    })
  }

  function improveSummary() {
    setSuggestion(null)
    improve.mutate({ target: 'summary' }, { onSuccess: (res) => setSuggestion(res.summary ?? '') })
  }

  return (
    <form id="identity" className="profile-card" onSubmit={save}>
      <div className="card-heading">
        <h3>Identity</h3>
        <button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="field-grid">
        <Field label="Full name" value={full_name} onChange={setFullName} />
        <Field label="Headline" value={headline} onChange={setHeadline} placeholder="Data Analyst & BI Specialist" />
        <Field label="Seniority" value={seniority} onChange={setSeniority} placeholder="Mid-level / Senior" />
        <Field label="Years of experience" type="number" value={years} onChange={setYears} />
      </div>
      <label className="field">
        <span className="field-label-row">
          Professional summary
          <button type="button" className="ai-btn" onClick={improveSummary} disabled={improve.isPending}>
            {improve.isPending ? '✨ Thinking…' : '✨ Improve'}
          </button>
        </span>
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} />
      </label>
      {suggestion ? (
        <Suggestion text={suggestion} note={improve.data?.note} onAccept={() => { setSummary(suggestion); setSuggestion(null) }} onDismiss={() => setSuggestion(null)} />
      ) : null}
      <Field label="Target roles (comma-separated)" value={roles} onChange={setRoles} placeholder="Data Analyst, BI Developer" />
      {update.isError ? <ErrorNotice error={update.error} /> : null}
    </form>
  )
}

/* ── Chips (skills / certs) ───────────────────────────── */

function ChipSection({
  id,
  title,
  hint,
  kind,
  skills,
}: {
  id: string
  title: string
  hint: string
  kind: 'IT_SKILL' | 'CERT'
  skills: Skill[]
}) {
  const create = useCreateSkillMutation()
  const remove = useDeleteSkillMutation()
  const [value, setValue] = useState('')

  function add() {
    const name = value.trim()
    if (!name) return
    create.mutate({ name, kind, source: 'MANUAL' }, { onSuccess: () => setValue('') })
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      add()
    }
  }

  return (
    <section id={id} className="profile-card">
      <div className="card-heading">
        <div>
          <h3>{title}</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>{hint}</p>
        </div>
      </div>
      <div className="chip-cloud">
        {skills.map((skill) => (
          <span className="tag-chip" key={skill.id}>
            {skill.name}
            <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => remove.mutate(skill.id)}>×</button>
          </span>
        ))}
        {skills.length === 0 ? <span className="muted">None yet.</span> : null}
      </div>
      <div className="chip-add">
        <input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={onKey} placeholder={`Add ${title.toLowerCase()}…`} />
        <button type="button" className="secondary-button" onClick={add} disabled={create.isPending || value.trim().length === 0}>Add</button>
      </div>
    </section>
  )
}

function LanguagesSection({ languages }: { languages: Skill[] }) {
  const create = useCreateSkillMutation()
  const remove = useDeleteSkillMutation()
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')

  function add() {
    if (!name.trim()) return
    create.mutate({ name: name.trim(), kind: 'LANGUAGE', level: nullIfEmpty(level), source: 'MANUAL' }, { onSuccess: () => { setName(''); setLevel('') } })
  }

  return (
    <section id="languages" className="profile-card">
      <div className="card-heading">
        <div>
          <h3>Languages</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>Your German level is one of the biggest real-world filters here.</p>
        </div>
      </div>
      <div className="chip-cloud">
        {languages.map((lang) => (
          <span className="tag-chip tag-chip-lang" key={lang.id}>
            {lang.name}{lang.level ? <em> · {lang.level}</em> : null}
            <button type="button" aria-label={`Remove ${lang.name}`} onClick={() => remove.mutate(lang.id)}>×</button>
          </span>
        ))}
        {languages.length === 0 ? <span className="muted">None yet — add at least German and English.</span> : null}
      </div>
      <div className="chip-add chip-add-lang">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Language (e.g. German)" />
        <input value={level} onChange={(event) => setLevel(event.target.value)} placeholder="Level (B2, C1, native)" />
        <button type="button" className="secondary-button" onClick={add} disabled={create.isPending || name.trim().length === 0}>Add</button>
      </div>
    </section>
  )
}

/* ── Experience ───────────────────────────────────────── */

function ExperienceSection({ experiences }: { experiences: Experience[] }) {
  const create = useCreateExperienceMutation()
  const [adding, setAdding] = useState(false)

  return (
    <section id="experience" className="profile-card">
      <div className="card-heading">
        <h3>Experience</h3>
        {!adding ? <button type="button" className="secondary-button" onClick={() => setAdding(true)}>+ Add</button> : null}
      </div>
      {adding ? (
        <ExperienceForm
          onCancel={() => setAdding(false)}
          onSubmit={(input) => create.mutate(input, { onSuccess: () => setAdding(false) })}
          saving={create.isPending}
        />
      ) : null}
      <div className="entry-list">
        {experiences.map((exp) => <ExperienceCard key={exp.id} experience={exp} />)}
        {experiences.length === 0 && !adding ? <p className="muted">No experience yet — add your roles so we can tailor materials.</p> : null}
      </div>
    </section>
  )
}

function ExperienceCard({ experience }: { experience: Experience }) {
  const update = useUpdateExperienceMutation()
  const remove = useDeleteExperienceMutation()
  const improve = useImproveFieldMutation()
  const [editing, setEditing] = useState(false)
  const [bulletSuggestion, setBulletSuggestion] = useState<string[] | null>(null)

  if (editing) {
    return (
      <ExperienceForm
        experience={experience}
        onCancel={() => setEditing(false)}
        onSubmit={(input) => update.mutate({ id: experience.id, input }, { onSuccess: () => setEditing(false) })}
        saving={update.isPending}
      />
    )
  }

  const dates = [experience.start, experience.is_current ? 'present' : experience.end].filter(Boolean).join(' – ')

  function improveBullets() {
    setBulletSuggestion(null)
    improve.mutate({ target: 'experience_bullets', experienceId: experience.id }, { onSuccess: (res) => setBulletSuggestion(res.bullets) })
  }

  function acceptBullets() {
    if (!bulletSuggestion) return
    update.mutate({ id: experience.id, input: { bullets: bulletSuggestion } }, { onSuccess: () => setBulletSuggestion(null) })
  }

  return (
    <article className="entry-card">
      <div className="entry-head">
        <div>
          <strong>{experience.title}</strong>
          <span className="entry-sub">{[experience.company, dates].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="entry-actions">
          <button type="button" className="ai-btn" onClick={improveBullets} disabled={improve.isPending}>
            {improve.isPending ? '✨…' : '✨ Improve bullets'}
          </button>
          <button type="button" className="icon-btn" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="icon-btn icon-danger" onClick={() => remove.mutate(experience.id)}>Delete</button>
        </div>
      </div>
      {experience.bullets.length > 0 ? (
        <ul className="entry-bullets">{experience.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      ) : (
        <p className="muted entry-empty">No achievements yet — add a few or use ✨ Improve.</p>
      )}
      {bulletSuggestion ? (
        <div className="suggestion">
          <p className="suggestion-note">✨ Suggested bullets{improve.data?.note ? ` — ${improve.data.note}` : ''}</p>
          <ul className="entry-bullets">{bulletSuggestion.map((b, i) => <li key={i}>{b}</li>)}</ul>
          <div className="row-actions">
            <button type="button" onClick={acceptBullets} disabled={update.isPending}>Use these</button>
            <button type="button" className="secondary-button" onClick={() => setBulletSuggestion(null)}>Dismiss</button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function ExperienceForm({
  experience,
  onSubmit,
  onCancel,
  saving,
}: {
  experience?: Experience
  onSubmit: (input: { title: string; company: string | null; start: string | null; end: string | null; is_current: boolean; summary: string | null; bullets: string[]; tech: string[] }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle] = useState(experience?.title ?? '')
  const [company, setCompany] = useState(experience?.company ?? '')
  const [start, setStart] = useState(experience?.start ?? '')
  const [end, setEnd] = useState(experience?.end ?? '')
  const [isCurrent, setIsCurrent] = useState(experience?.is_current ?? false)
  const [bullets, setBullets] = useState((experience?.bullets ?? []).join('\n'))
  const [tech, setTech] = useState((experience?.tech ?? []).join(', '))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      company: nullIfEmpty(company),
      start: nullIfEmpty(start),
      end: isCurrent ? null : nullIfEmpty(end),
      is_current: isCurrent,
      summary: null,
      bullets: splitLines(bullets),
      tech: splitComma(tech),
    })
  }

  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="field-grid">
        <Field label="Title" value={title} onChange={setTitle} placeholder="Data Analyst" />
        <Field label="Company" value={company} onChange={setCompany} />
        <Field label="Start (YYYY-MM)" value={start} onChange={setStart} placeholder="2022-06" />
        <Field label="End (YYYY-MM)" value={end} onChange={setEnd} placeholder="2023-07" />
      </div>
      <label className="checkbox-field"><input type="checkbox" checked={isCurrent} onChange={(event) => setIsCurrent(event.target.checked)} /> Current role</label>
      <label className="field">Achievements (one per line)
        <textarea value={bullets} onChange={(event) => setBullets(event.target.value)} rows={4} placeholder="Cut report time 50% with Python ETL" />
      </label>
      <Field label="Tech (comma-separated)" value={tech} onChange={setTech} placeholder="Python, SQL, Power BI" />
      <div className="row-actions">
        <button type="submit" disabled={saving || title.trim().length === 0}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/* ── Education ────────────────────────────────────────── */

function EducationSection({ education }: { education: Education[] }) {
  const create = useCreateEducationMutation()
  const [adding, setAdding] = useState(false)
  return (
    <section id="education" className="profile-card">
      <div className="card-heading">
        <h3>Education</h3>
        {!adding ? <button type="button" className="secondary-button" onClick={() => setAdding(true)}>+ Add</button> : null}
      </div>
      {adding ? <EducationForm onCancel={() => setAdding(false)} saving={create.isPending} onSubmit={(input) => create.mutate(input, { onSuccess: () => setAdding(false) })} /> : null}
      <div className="entry-list">
        {education.map((item) => <EducationCard key={item.id} item={item} />)}
        {education.length === 0 && !adding ? <p className="muted">No education added yet.</p> : null}
      </div>
    </section>
  )
}

function EducationCard({ item }: { item: Education }) {
  const update = useUpdateEducationMutation()
  const remove = useDeleteEducationMutation()
  const [editing, setEditing] = useState(false)
  if (editing) {
    return <EducationForm item={item} onCancel={() => setEditing(false)} saving={update.isPending} onSubmit={(input) => update.mutate({ id: item.id, input }, { onSuccess: () => setEditing(false) })} />
  }
  const dates = [item.start, item.end].filter(Boolean).join(' – ')
  const sub = [item.institution, item.field_of_study, dates].filter(Boolean).join(' · ')
  return (
    <article className="entry-card">
      <div className="entry-head">
        <div>
          <strong>{item.degree}{item.grade ? <span className="entry-grade"> · {item.grade}</span> : null}</strong>
          {sub ? <span className="entry-sub">{sub}</span> : null}
        </div>
        <div className="entry-actions">
          <button type="button" className="icon-btn" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="icon-btn icon-danger" onClick={() => remove.mutate(item.id)}>Delete</button>
        </div>
      </div>
      {item.summary ? <p className="entry-note">{item.summary}</p> : null}
    </article>
  )
}

function EducationForm({
  item,
  onSubmit,
  onCancel,
  saving,
}: {
  item?: Education
  onSubmit: (input: { degree: string; institution: string | null; field_of_study: string | null; start: string | null; end: string | null; grade: string | null; summary: string | null }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [degree, setDegree] = useState(item?.degree ?? '')
  const [institution, setInstitution] = useState(item?.institution ?? '')
  const [field, setField] = useState(item?.field_of_study ?? '')
  const [start, setStart] = useState(item?.start ?? '')
  const [end, setEnd] = useState(item?.end ?? '')
  const [grade, setGrade] = useState(item?.grade ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!degree.trim()) return
    onSubmit({
      degree: degree.trim(),
      institution: nullIfEmpty(institution),
      field_of_study: nullIfEmpty(field),
      start: nullIfEmpty(start),
      end: nullIfEmpty(end),
      grade: nullIfEmpty(grade),
      summary: null,
    })
  }

  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="field-grid">
        <Field label="Degree" value={degree} onChange={setDegree} placeholder="B.Sc. Computer Science" />
        <Field label="Institution" value={institution} onChange={setInstitution} />
        <Field label="Field of study" value={field} onChange={setField} />
        <Field label="Grade" value={grade} onChange={setGrade} placeholder="1.7" />
        <Field label="Start (YYYY-MM)" value={start} onChange={setStart} />
        <Field label="End (YYYY-MM)" value={end} onChange={setEnd} />
      </div>
      <div className="row-actions">
        <button type="submit" disabled={saving || degree.trim().length === 0}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/* ── Projects ─────────────────────────────────────────── */

function ProjectSection({ projects }: { projects: Project[] }) {
  const create = useCreateProjectMutation()
  const [adding, setAdding] = useState(false)
  return (
    <section id="projects" className="profile-card">
      <div className="card-heading">
        <h3>Projects</h3>
        {!adding ? <button type="button" className="secondary-button" onClick={() => setAdding(true)}>+ Add</button> : null}
      </div>
      {adding ? <ProjectForm onCancel={() => setAdding(false)} saving={create.isPending} onSubmit={(input) => create.mutate(input, { onSuccess: () => setAdding(false) })} /> : null}
      <div className="entry-list">
        {projects.map((item) => <ProjectCard key={item.id} item={item} />)}
        {projects.length === 0 && !adding ? <p className="muted">No projects yet.</p> : null}
      </div>
    </section>
  )
}

function ProjectCard({ item }: { item: Project }) {
  const update = useUpdateProjectMutation()
  const remove = useDeleteProjectMutation()
  const [editing, setEditing] = useState(false)
  if (editing) {
    return <ProjectForm item={item} onCancel={() => setEditing(false)} saving={update.isPending} onSubmit={(input) => update.mutate({ id: item.id, input }, { onSuccess: () => setEditing(false) })} />
  }
  return (
    <article className="entry-card">
      <div className="entry-head">
        <div>
          <strong>{item.name}{item.role ? <span className="entry-sub-inline"> · {item.role}</span> : null}</strong>
          {item.tech.length > 0 ? <span className="entry-sub">{item.tech.join(', ')}</span> : null}
        </div>
        <div className="entry-actions">
          <button type="button" className="icon-btn" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="icon-btn icon-danger" onClick={() => remove.mutate(item.id)}>Delete</button>
        </div>
      </div>
      {item.summary ? <p className="entry-note">{item.summary}</p> : null}
    </article>
  )
}

function ProjectForm({
  item,
  onSubmit,
  onCancel,
  saving,
}: {
  item?: Project
  onSubmit: (input: { name: string; role: string | null; summary: string | null; tech: string[]; links: string[] }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [role, setRole] = useState(item?.role ?? '')
  const [summary, setSummary] = useState(item?.summary ?? '')
  const [tech, setTech] = useState((item?.tech ?? []).join(', '))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), role: nullIfEmpty(role), summary: nullIfEmpty(summary), tech: splitComma(tech), links: item?.links ?? [] })
  }

  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="field-grid">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Role" value={role} onChange={setRole} />
      </div>
      <label className="field">Summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} /></label>
      <Field label="Tech (comma-separated)" value={tech} onChange={setTech} />
      <div className="row-actions">
        <button type="submit" disabled={saving || name.trim().length === 0}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/* ── Links ────────────────────────────────────────────── */

function LinksSection({ links }: { links: Array<Record<string, unknown>> }) {
  const update = useUpdateProfileMutation()
  const [rows, setRows] = useState<Array<{ label: string; url: string }>>([])

  useEffect(() => {
    setRows(links.map((link) => ({ label: stringValue(link.label), url: stringValue(link.url) })))
  }, [links])

  function save() {
    update.mutate({ links: rows.filter((r) => r.url.trim()).map((r) => ({ label: r.label.trim(), url: r.url.trim() })) })
  }

  return (
    <section id="links" className="profile-card">
      <div className="card-heading">
        <div>
          <h3>Links</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>GitHub, portfolio, LinkedIn — strong signals of your work.</p>
        </div>
        <button type="button" onClick={save} disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="entry-list">
        {rows.map((row, index) => (
          <div className="link-row" key={index}>
            <input value={row.label} onChange={(event) => setRows((c) => c.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))} placeholder="GitHub" />
            <input value={row.url} onChange={(event) => setRows((c) => c.map((r, i) => (i === index ? { ...r, url: event.target.value } : r)))} placeholder="https://…" />
            <button type="button" className="icon-btn icon-danger" onClick={() => setRows((c) => c.filter((_, i) => i !== index))}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" className="secondary-button" onClick={() => setRows((c) => [...c, { label: '', url: '' }])}>+ Add link</button>
    </section>
  )
}

/* ── Shared bits ──────────────────────────────────────── */

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="field">
      {label}
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Suggestion({ text, note, onAccept, onDismiss }: { text: string; note?: string; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="suggestion">
      <p className="suggestion-note">✨ Suggested{note ? ` — ${note}` : ''}</p>
      <p className="suggestion-text">{text}</p>
      <div className="row-actions">
        <button type="button" onClick={onAccept}>Use this</button>
        <button type="button" className="secondary-button" onClick={onDismiss}>Dismiss</button>
      </div>
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

function targetRolesText(profile: Profile): string {
  const roles = profile.preferences?.target_roles
  return Array.isArray(roles) ? roles.map(String).join(', ') : ''
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function splitLines(value: string): string[] {
  return value.split('\n').map((v) => v.trim()).filter(Boolean)
}

function splitComma(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/* ── Enrich modal (AI Q&A) ────────────────────────────── */

function EnrichModal({ onClose, hasProfile }: { onClose: () => void; hasProfile: boolean }) {
  const questions = useEnrichQuestionsMutation()
  const apply = useEnrichApplyMutation()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ changes: string[]; addedSkills: string[] } | null>(null)

  const items: EnrichQuestion[] = questions.data?.questions ?? []
  const askRef = useRef(questions.mutate)
  askRef.current = questions.mutate

  useEffect(() => {
    askRef.current()
  }, [])

  function ask() {
    setResult(null)
    setAnswers({})
    questions.mutate()
  }

  function applyAnswers() {
    const payload: EnrichAnswer[] = items
      .filter((q) => (answers[q.key] ?? '').trim().length > 0)
      .map((q) => ({ key: q.key, question: q.question, answer: answers[q.key].trim() }))
    if (payload.length === 0) return
    apply.mutate(payload, {
      onSuccess: (data) => {
        setResult({ changes: data.changes, addedSkills: data.added_skills })
        questions.reset()
        setAnswers({})
      },
    })
  }

  const answeredCount = items.filter((q) => (answers[q.key] ?? '').trim().length > 0).length

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="enrich-title" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">✦ AI enrichment</p>
            <h2 id="enrich-title">Strengthen your profile</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          {questions.isPending ? <p className="muted loading-pulse">Looking at your profile for gaps…</p> : null}
          {!hasProfile && items.length === 0 && !questions.isPending ? (
            <p className="muted">Tip: paste your CV or add a few skills first — the questions get sharper.</p>
          ) : null}
          {questions.isError ? <ErrorNotice error={questions.error} /> : null}

          {result ? (
            <div className="notice enrich-result">
              <h3>✓ Profile updated</h3>
              {result.changes.length > 0 ? (
                <ul className="compact-list">{result.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
              ) : null}
              {result.addedSkills.length > 0 ? (
                <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>Added skills: {result.addedSkills.join(', ')}</p>
              ) : null}
            </div>
          ) : null}

          {items.length > 0 ? (
            <form className="stacked-editor" onSubmit={(event) => { event.preventDefault(); applyAnswers() }}>
              {items.map((q) => (
                <label key={q.key} className="field">
                  <span className="enrich-q">
                    <span className={`enrich-field enrich-field-${q.field}`}>{enrichFieldLabel(q.field)}</span>
                    {q.question}
                  </span>
                  {q.purpose ? <span className="muted enrich-purpose">{q.purpose}</span> : null}
                  <textarea rows={2} value={answers[q.key] ?? ''} onChange={(event) => setAnswers((prev) => ({ ...prev, [q.key]: event.target.value }))} placeholder="Your answer…" />
                </label>
              ))}
              {apply.isError ? <ErrorNotice error={apply.error} /> : null}
            </form>
          ) : null}
        </div>

        <div className="modal-foot">
          <button type="button" className="secondary-button" onClick={ask} disabled={questions.isPending}>
            {questions.isPending ? 'Thinking…' : 'New questions'}
          </button>
          <span className="muted">{answeredCount} of {items.length} answered</span>
          {result ? (
            <button type="button" onClick={onClose}>Done</button>
          ) : (
            <button type="button" onClick={applyAnswers} disabled={apply.isPending || answeredCount === 0}>
              {apply.isPending ? 'Applying…' : `Apply ${answeredCount || ''} answer${answeredCount === 1 ? '' : 's'}`.trim()}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function enrichFieldLabel(field: EnrichQuestion['field']): string {
  switch (field) {
    case 'years_exp':
      return 'experience'
    case 'target_roles':
      return 'target'
    default:
      return field
  }
}
