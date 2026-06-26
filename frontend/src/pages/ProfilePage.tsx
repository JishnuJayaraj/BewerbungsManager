import { type FormEvent, useEffect, useState } from 'react'
import {
  ApiError,
  useCreateExperienceMutation,
  useCreateProjectMutation,
  useCreateSkillMutation,
  useDeleteExperienceMutation,
  useDeleteProjectMutation,
  useDeleteSkillMutation,
  useEnrichApplyMutation,
  useEnrichQuestionsMutation,
  useParseCvMutation,
  useProfileQuery,
  useUpdateExperienceMutation,
  useUpdateProfileMutation,
  useUpdateProjectMutation,
  useUpdateSkillMutation,
  type EnrichAnswer,
  type EnrichQuestion,
  type Experience,
  type ExperienceInput,
  type Profile,
  type Project,
  type ProjectInput,
  type Skill,
  type SkillInput,
  type SkillKind,
} from '../api'

const skillKinds: SkillKind[] = ['IT_SKILL', 'SOFT_SKILL', 'LANGUAGE', 'CERT']

type ProfileForm = {
  full_name: string
  headline: string
  seniority: string
  years_exp: string
  summary: string
  default_tone: string
  default_language: string
  default_target_angle: string
}

type SkillForm = {
  name: string
  kind: SkillKind
  level: string
}

type ExperienceForm = {
  title: string
  company: string
  start: string
  end: string
  is_current: boolean
  summary: string
  bullets: string
  tech: string
}

type ProjectForm = {
  name: string
  role: string
  summary: string
  tech: string
  links: string
}

const emptyProfileForm: ProfileForm = {
  full_name: '',
  headline: '',
  seniority: '',
  years_exp: '',
  summary: '',
  default_tone: 'direct, professional',
  default_language: 'DE',
  default_target_angle: '',
}

const emptySkillForm: SkillForm = {
  name: '',
  kind: 'IT_SKILL',
  level: '',
}

const emptyExperienceForm: ExperienceForm = {
  title: '',
  company: '',
  start: '',
  end: '',
  is_current: false,
  summary: '',
  bullets: '',
  tech: '',
}

const emptyProjectForm: ProjectForm = {
  name: '',
  role: '',
  summary: '',
  tech: '',
  links: '',
}

export function ProfilePage() {
  const profile = useProfileQuery()
  const updateProfile = useUpdateProfileMutation()
  const parseCv = useParseCvMutation()
  const [form, setForm] = useState<ProfileForm>(emptyProfileForm)
  const [cvText, setCvText] = useState('')

  useEffect(() => {
    if (profile.data) {
      setForm(profileToForm(profile.data))
    }
  }, [profile.data])

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateProfile.mutate(formToProfileUpdate(form))
  }

  function submitParse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    parseCv.mutate(cvText)
  }

  return (
    <section className="profile-layout" aria-labelledby="profile-title">
      <div className="section-heading">
        <p className="eyebrow">Profile</p>
        <h2 id="profile-title">Profile editor</h2>
      </div>

      {profile.isPending ? <p className="muted">Loading profile...</p> : null}
      {profile.isError ? <ErrorNotice error={profile.error} /> : null}
      {profile.data?.parse_warning ? <div className="notice notice-error">{profile.data.parse_warning}</div> : null}

      <form className="profile-card profile-card-wide" onSubmit={submitParse}>
        <div className="card-heading">
          <h3>CV paste</h3>
          <button type="submit" disabled={parseCv.isPending || cvText.trim().length === 0}>
            {parseCv.isPending ? 'Parsing...' : 'Parse'}
          </button>
        </div>
        <label>
          CV text
          <textarea
            value={cvText}
            onChange={(event) => setCvText(event.target.value)}
            rows={8}
          />
        </label>
        {parseCv.isError ? <ErrorNotice error={parseCv.error} /> : null}
      </form>

      <EnrichPanel hasProfile={Boolean(profile.data)} />

      <form className="profile-card profile-card-wide" onSubmit={saveProfile}>
        <div className="card-heading">
          <h3>Identity</h3>
          <button type="submit" disabled={updateProfile.isPending || profile.isPending}>
            {updateProfile.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="field-grid">
          <TextField label="Full name" value={form.full_name} onChange={(value) => setFormField(setForm, 'full_name', value)} />
          <TextField label="Headline" value={form.headline} onChange={(value) => setFormField(setForm, 'headline', value)} />
          <TextField label="Seniority" value={form.seniority} onChange={(value) => setFormField(setForm, 'seniority', value)} />
          <TextField
            label="Years"
            type="number"
            value={form.years_exp}
            onChange={(value) => setFormField(setForm, 'years_exp', value)}
          />
        </div>
        <label>
          Summary
          <textarea
            value={form.summary}
            onChange={(event) => setFormField(setForm, 'summary', event.target.value)}
            rows={5}
          />
        </label>
        <div className="field-grid">
          <TextField label="Default tone" value={form.default_tone} onChange={(value) => setFormField(setForm, 'default_tone', value)} />
          <label>
            Default language
            <select
              value={form.default_language}
              onChange={(event) => setFormField(setForm, 'default_language', event.target.value)}
            >
              <option value="DE">DE</option>
              <option value="EN">EN</option>
            </select>
          </label>
          <TextField
            label="Default angle"
            value={form.default_target_angle}
            onChange={(value) => setFormField(setForm, 'default_target_angle', value)}
          />
        </div>
        {updateProfile.isError ? <ErrorNotice error={updateProfile.error} /> : null}
      </form>

      {profile.data ? (
        <>
          <SkillsSection skills={profile.data.skills} />
          <ExperiencesSection experiences={profile.data.experiences} />
          <ProjectsSection projects={profile.data.projects} />
        </>
      ) : null}
    </section>
  )
}

function EnrichPanel({ hasProfile }: { hasProfile: boolean }) {
  const questions = useEnrichQuestionsMutation()
  const apply = useEnrichApplyMutation()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ changes: string[]; addedSkills: string[] } | null>(null)

  const items: EnrichQuestion[] = questions.data?.questions ?? []

  function ask() {
    setResult(null)
    setAnswers({})
    questions.mutate()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    <section className="profile-card profile-card-wide prompt-card" aria-labelledby="enrich-title">
      <div className="card-heading">
        <div>
          <h3 id="enrich-title">Enrich with AI</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Let the assistant spot gaps and ask a few targeted questions. Your answers fold back
            into your profile.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={ask} disabled={questions.isPending}>
          {questions.isPending ? 'Thinking…' : items.length > 0 ? 'New questions' : 'Ask AI'}
        </button>
      </div>

      {!hasProfile && items.length === 0 ? (
        <p className="muted">Tip: paste your CV or add a few skills first — the questions get sharper.</p>
      ) : null}
      {questions.isError ? <ErrorNotice error={questions.error} /> : null}

      {items.length > 0 ? (
        <form className="stacked-editor" onSubmit={submit}>
          {items.map((q) => (
            <label key={q.key}>
              <span className="enrich-q">
                <span className={`enrich-field enrich-field-${q.field}`}>{enrichFieldLabel(q.field)}</span>
                {q.question}
              </span>
              {q.purpose ? <span className="muted enrich-purpose">{q.purpose}</span> : null}
              <textarea
                rows={2}
                value={answers[q.key] ?? ''}
                onChange={(event) => setAnswers((prev) => ({ ...prev, [q.key]: event.target.value }))}
                placeholder="Your answer…"
              />
            </label>
          ))}
          <div className="row-actions">
            <button type="submit" disabled={apply.isPending || answeredCount === 0}>
              {apply.isPending ? 'Applying…' : `Apply ${answeredCount || ''} answer${answeredCount === 1 ? '' : 's'}`.trim()}
            </button>
            <span className="muted">{answeredCount} of {items.length} answered</span>
          </div>
          {apply.isError ? <ErrorNotice error={apply.error} /> : null}
        </form>
      ) : null}

      {result ? (
        <div className="notice enrich-result">
          <h3>Profile updated</h3>
          {result.changes.length > 0 ? (
            <ul className="compact-list">
              {result.changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          ) : null}
          {result.addedSkills.length > 0 ? (
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              Added skills: {result.addedSkills.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
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

function SkillsSection({ skills }: { skills: Skill[] }) {
  const createSkill = useCreateSkillMutation()
  const updateSkill = useUpdateSkillMutation()
  const deleteSkill = useDeleteSkillMutation()
  const [newSkill, setNewSkill] = useState<SkillForm>(emptySkillForm)
  const [drafts, setDrafts] = useState<Record<string, SkillForm>>({})

  useEffect(() => {
    setDrafts(Object.fromEntries(skills.map((skill) => [skill.id, skillToForm(skill)])))
  }, [skills])

  function addSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createSkill.mutate(skillFormToInput(newSkill), {
      onSuccess: () => setNewSkill(emptySkillForm),
    })
  }

  return (
    <section className="profile-card profile-card-wide" aria-labelledby="skills-title">
      <div className="card-heading">
        <h3 id="skills-title">Skills</h3>
      </div>
      <form className="compact-editor" onSubmit={addSkill}>
        <SkillFields value={newSkill} onChange={setNewSkill} />
        <button type="submit" disabled={createSkill.isPending || newSkill.name.trim().length === 0}>
          Add
        </button>
      </form>
      {createSkill.isError ? <ErrorNotice error={createSkill.error} /> : null}
      <div className="editor-list">
        {skills.map((skill) => {
          const draft = drafts[skill.id] ?? skillToForm(skill)
          return (
            <form
              className="compact-editor"
              key={skill.id}
              onSubmit={(event) => {
                event.preventDefault()
                updateSkill.mutate({ id: skill.id, input: skillFormToInput(draft) })
              }}
            >
              <SkillFields
                value={draft}
                onChange={(next) => setDrafts((current) => ({ ...current, [skill.id]: next }))}
              />
              <div className="row-actions">
                <button type="submit" disabled={updateSkill.isPending}>Save</button>
                <button type="button" className="secondary-button" onClick={() => deleteSkill.mutate(skill.id)}>
                  Delete
                </button>
              </div>
            </form>
          )
        })}
      </div>
      {updateSkill.isError ? <ErrorNotice error={updateSkill.error} /> : null}
      {deleteSkill.isError ? <ErrorNotice error={deleteSkill.error} /> : null}
    </section>
  )
}

function ExperiencesSection({ experiences }: { experiences: Experience[] }) {
  const createExperience = useCreateExperienceMutation()
  const updateExperience = useUpdateExperienceMutation()
  const deleteExperience = useDeleteExperienceMutation()
  const [newExperience, setNewExperience] = useState<ExperienceForm>(emptyExperienceForm)
  const [drafts, setDrafts] = useState<Record<string, ExperienceForm>>({})

  useEffect(() => {
    setDrafts(Object.fromEntries(experiences.map((item) => [item.id, experienceToForm(item)])))
  }, [experiences])

  function addExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createExperience.mutate(experienceFormToInput(newExperience), {
      onSuccess: () => setNewExperience(emptyExperienceForm),
    })
  }

  return (
    <section className="profile-card profile-card-wide" aria-labelledby="experience-title">
      <div className="card-heading">
        <h3 id="experience-title">Experiences</h3>
      </div>
      <form className="stacked-editor" onSubmit={addExperience}>
        <ExperienceFields value={newExperience} onChange={setNewExperience} />
        <button type="submit" disabled={createExperience.isPending || newExperience.title.trim().length === 0}>
          Add
        </button>
      </form>
      {createExperience.isError ? <ErrorNotice error={createExperience.error} /> : null}
      <div className="editor-list">
        {experiences.map((experience) => {
          const draft = drafts[experience.id] ?? experienceToForm(experience)
          return (
            <form
              className="stacked-editor"
              key={experience.id}
              onSubmit={(event) => {
                event.preventDefault()
                updateExperience.mutate({ id: experience.id, input: experienceFormToInput(draft) })
              }}
            >
              <ExperienceFields
                value={draft}
                onChange={(next) => setDrafts((current) => ({ ...current, [experience.id]: next }))}
              />
              <div className="row-actions">
                <button type="submit" disabled={updateExperience.isPending}>Save</button>
                <button type="button" className="secondary-button" onClick={() => deleteExperience.mutate(experience.id)}>
                  Delete
                </button>
              </div>
            </form>
          )
        })}
      </div>
      {updateExperience.isError ? <ErrorNotice error={updateExperience.error} /> : null}
      {deleteExperience.isError ? <ErrorNotice error={deleteExperience.error} /> : null}
    </section>
  )
}

function ProjectsSection({ projects }: { projects: Project[] }) {
  const createProject = useCreateProjectMutation()
  const updateProject = useUpdateProjectMutation()
  const deleteProject = useDeleteProjectMutation()
  const [newProject, setNewProject] = useState<ProjectForm>(emptyProjectForm)
  const [drafts, setDrafts] = useState<Record<string, ProjectForm>>({})

  useEffect(() => {
    setDrafts(Object.fromEntries(projects.map((project) => [project.id, projectToForm(project)])))
  }, [projects])

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createProject.mutate(projectFormToInput(newProject), {
      onSuccess: () => setNewProject(emptyProjectForm),
    })
  }

  return (
    <section className="profile-card profile-card-wide" aria-labelledby="projects-title">
      <div className="card-heading">
        <h3 id="projects-title">Projects</h3>
      </div>
      <form className="stacked-editor" onSubmit={addProject}>
        <ProjectFields value={newProject} onChange={setNewProject} />
        <button type="submit" disabled={createProject.isPending || newProject.name.trim().length === 0}>
          Add
        </button>
      </form>
      {createProject.isError ? <ErrorNotice error={createProject.error} /> : null}
      <div className="editor-list">
        {projects.map((project) => {
          const draft = drafts[project.id] ?? projectToForm(project)
          return (
            <form
              className="stacked-editor"
              key={project.id}
              onSubmit={(event) => {
                event.preventDefault()
                updateProject.mutate({ id: project.id, input: projectFormToInput(draft) })
              }}
            >
              <ProjectFields
                value={draft}
                onChange={(next) => setDrafts((current) => ({ ...current, [project.id]: next }))}
              />
              <div className="row-actions">
                <button type="submit" disabled={updateProject.isPending}>Save</button>
                <button type="button" className="secondary-button" onClick={() => deleteProject.mutate(project.id)}>
                  Delete
                </button>
              </div>
            </form>
          )
        })}
      </div>
      {updateProject.isError ? <ErrorNotice error={updateProject.error} /> : null}
      {deleteProject.isError ? <ErrorNotice error={deleteProject.error} /> : null}
    </section>
  )
}

function SkillFields({ value, onChange }: { value: SkillForm; onChange: (value: SkillForm) => void }) {
  return (
    <>
      <TextField label="Name" value={value.name} onChange={(next) => onChange({ ...value, name: next })} />
      <label>
        Kind
        <select
          value={value.kind}
          onChange={(event) => onChange({ ...value, kind: event.target.value as SkillKind })}
        >
          {skillKinds.map((kind) => (
            <option key={kind} value={kind}>{kind}</option>
          ))}
        </select>
      </label>
      <TextField label="Level" value={value.level} onChange={(next) => onChange({ ...value, level: next })} />
    </>
  )
}

function ExperienceFields({ value, onChange }: { value: ExperienceForm; onChange: (value: ExperienceForm) => void }) {
  return (
    <>
      <div className="field-grid">
        <TextField label="Title" value={value.title} onChange={(next) => onChange({ ...value, title: next })} />
        <TextField label="Company" value={value.company} onChange={(next) => onChange({ ...value, company: next })} />
        <TextField label="Start" value={value.start} onChange={(next) => onChange({ ...value, start: next })} placeholder="2024-01" />
        <TextField label="End" value={value.end} onChange={(next) => onChange({ ...value, end: next })} placeholder="2025-12" />
      </div>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value.is_current}
          onChange={(event) => onChange({ ...value, is_current: event.target.checked })}
        />
        Current role
      </label>
      <label>
        Summary
        <textarea value={value.summary} onChange={(event) => onChange({ ...value, summary: event.target.value })} rows={3} />
      </label>
      <label>
        Bullets
        <textarea value={value.bullets} onChange={(event) => onChange({ ...value, bullets: event.target.value })} rows={4} />
      </label>
      <TextField label="Tech" value={value.tech} onChange={(next) => onChange({ ...value, tech: next })} />
    </>
  )
}

function ProjectFields({ value, onChange }: { value: ProjectForm; onChange: (value: ProjectForm) => void }) {
  return (
    <>
      <div className="field-grid">
        <TextField label="Name" value={value.name} onChange={(next) => onChange({ ...value, name: next })} />
        <TextField label="Role" value={value.role} onChange={(next) => onChange({ ...value, role: next })} />
      </div>
      <label>
        Summary
        <textarea value={value.summary} onChange={(event) => onChange({ ...value, summary: event.target.value })} rows={3} />
      </label>
      <div className="field-grid">
        <TextField label="Tech" value={value.tech} onChange={(next) => onChange({ ...value, tech: next })} />
        <TextField label="Links" value={value.links} onChange={(next) => onChange({ ...value, links: next })} />
      </div>
    </>
  )
}

function TextField({
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
    <label>
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ErrorNotice({ error }: { error: Error }) {
  return (
    <div className="notice notice-error" role="alert">
      {error instanceof ApiError ? `${error.status} ${error.code}: ${error.message}` : error.message}
    </div>
  )
}

function profileToForm(profile: Profile): ProfileForm {
  return {
    full_name: profile.full_name ?? '',
    headline: profile.headline ?? '',
    seniority: profile.seniority ?? '',
    years_exp: profile.years_exp === null ? '' : String(profile.years_exp),
    summary: profile.summary ?? '',
    default_tone: stringValue(profile.brief_defaults.tone, 'direct, professional'),
    default_language: stringValue(profile.brief_defaults.language, 'DE'),
    default_target_angle: stringValue(profile.brief_defaults.target_angle, ''),
  }
}

function formToProfileUpdate(form: ProfileForm) {
  return {
    full_name: nullIfEmpty(form.full_name),
    headline: nullIfEmpty(form.headline),
    seniority: nullIfEmpty(form.seniority),
    years_exp: form.years_exp.trim() === '' ? null : Number(form.years_exp),
    summary: nullIfEmpty(form.summary),
    brief_defaults: {
      tone: form.default_tone,
      language: form.default_language,
      target_angle: form.default_target_angle,
    },
  }
}

function skillToForm(skill: Skill): SkillForm {
  return {
    name: skill.name,
    kind: skill.kind,
    level: skill.level ?? '',
  }
}

function skillFormToInput(form: SkillForm): SkillInput {
  return {
    name: form.name.trim(),
    kind: form.kind,
    level: nullIfEmpty(form.level),
    source: 'MANUAL',
  }
}

function experienceToForm(experience: Experience): ExperienceForm {
  return {
    title: experience.title,
    company: experience.company ?? '',
    start: experience.start ?? '',
    end: experience.end ?? '',
    is_current: experience.is_current,
    summary: experience.summary ?? '',
    bullets: experience.bullets.join('\n'),
    tech: experience.tech.join(', '),
  }
}

function experienceFormToInput(form: ExperienceForm): ExperienceInput {
  return {
    title: form.title.trim(),
    company: nullIfEmpty(form.company),
    start: nullIfEmpty(form.start),
    end: nullIfEmpty(form.end),
    is_current: form.is_current,
    summary: nullIfEmpty(form.summary),
    bullets: splitLines(form.bullets),
    tech: splitComma(form.tech),
  }
}

function projectToForm(project: Project): ProjectForm {
  return {
    name: project.name,
    role: project.role ?? '',
    summary: project.summary ?? '',
    tech: project.tech.join(', '),
    links: project.links.join(', '),
  }
}

function projectFormToInput(form: ProjectForm): ProjectInput {
  return {
    name: form.name.trim(),
    role: nullIfEmpty(form.role),
    summary: nullIfEmpty(form.summary),
    tech: splitComma(form.tech),
    links: splitComma(form.links),
  }
}

function setFormField<T extends Record<string, unknown>, K extends keyof T>(
  setState: (updater: (current: T) => T) => void,
  key: K,
  value: T[K],
) {
  setState((current) => ({ ...current, [key]: value }))
}

function nullIfEmpty(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitComma(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}
