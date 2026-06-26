import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  useCreateExperienceMutation,
  useCreateProjectMutation,
  useCreateSkillMutation,
  useDeleteExperienceMutation,
  useCreateEducationMutation,
  useDeleteEducationMutation,
  useDeleteProjectMutation,
  useDeleteSkillMutation,
  useEnrichApplyMutation,
  useEnrichQuestionsMutation,
  useParseCvMutation,
  useProfileQuery,
  useUpdateEducationMutation,
  useUpdateExperienceMutation,
  useUpdateProfileMutation,
  useUpdateProjectMutation,
  useUpdateSkillMutation,
  type Education,
  type EducationInput,
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

const skillKinds: SkillKind[] = ['IT_SKILL', 'SOFT_SKILL', 'CERT']

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

type EducationForm = {
  degree: string
  institution: string
  field_of_study: string
  start: string
  end: string
  grade: string
  summary: string
}

const emptyEducationForm: EducationForm = {
  degree: '',
  institution: '',
  field_of_study: '',
  start: '',
  end: '',
  grade: '',
  summary: '',
}

export function ProfilePage() {
  const profile = useProfileQuery()
  const updateProfile = useUpdateProfileMutation()
  const parseCv = useParseCvMutation()
  const [form, setForm] = useState<ProfileForm>(emptyProfileForm)
  const [cvText, setCvText] = useState('')
  const [enrichOpen, setEnrichOpen] = useState(false)

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

  const skills = profile.data?.skills ?? []
  const languages = skills.filter((skill) => skill.kind === 'LANGUAGE')
  const otherSkills = skills.filter((skill) => skill.kind !== 'LANGUAGE')

  return (
    <section className="profile-layout" aria-labelledby="profile-title">
      <div className="section-heading profile-hero">
        <div>
          <p className="eyebrow">Profile</p>
          <h2 id="profile-title">Your profile</h2>
          <p className="section-copy">
            The richer this is, the sharper your fit analysis and tailored materials. Paste a CV to
            start, then let the assistant fill the gaps.
          </p>
        </div>
        <button type="button" onClick={() => setEnrichOpen(true)}>✦ Enrich with AI</button>
      </div>

      {profile.isPending ? <p className="muted">Loading profile...</p> : null}
      {profile.isError ? <ErrorNotice error={profile.error} /> : null}
      {profile.data?.parse_warning ? <div className="notice notice-error">{profile.data.parse_warning}</div> : null}

      <form className="profile-card profile-card-wide" onSubmit={submitParse}>
        <div className="card-heading">
          <div>
            <h3>Import from CV</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>Paste your CV text — the AI extracts skills, experience, education and more.</p>
          </div>
          <button type="submit" disabled={parseCv.isPending || cvText.trim().length === 0}>
            {parseCv.isPending ? 'Parsing…' : 'Parse CV'}
          </button>
        </div>
        <label>
          CV text
          <textarea value={cvText} onChange={(event) => setCvText(event.target.value)} rows={8} />
        </label>
        {parseCv.isError ? <ErrorNotice error={parseCv.error} /> : null}
      </form>

      <form className="profile-card profile-card-wide" onSubmit={saveProfile}>
        <div className="card-heading">
          <h3>Identity</h3>
          <button type="submit" disabled={updateProfile.isPending || profile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="field-grid">
          <TextField label="Full name" value={form.full_name} onChange={(value) => setFormField(setForm, 'full_name', value)} />
          <TextField label="Headline" value={form.headline} onChange={(value) => setFormField(setForm, 'headline', value)} />
          <TextField label="Seniority" value={form.seniority} onChange={(value) => setFormField(setForm, 'seniority', value)} />
          <TextField label="Years of experience" type="number" value={form.years_exp} onChange={(value) => setFormField(setForm, 'years_exp', value)} />
        </div>
        <label>
          Professional summary
          <textarea value={form.summary} onChange={(event) => setFormField(setForm, 'summary', event.target.value)} rows={5} />
        </label>
        {updateProfile.isError ? <ErrorNotice error={updateProfile.error} /> : null}
      </form>

      {profile.data ? (
        <>
          <SkillsSection skills={otherSkills} />
          <LanguagesSection languages={languages} />
          <ExperiencesSection experiences={profile.data.experiences} />
          <EducationSection education={profile.data.education} />
          <ProjectsSection projects={profile.data.projects} />
          <LinksSection links={profile.data.links} />
        </>
      ) : null}

      {enrichOpen ? <EnrichModal onClose={() => setEnrichOpen(false)} hasProfile={Boolean(profile.data)} /> : null}
    </section>
  )
}

function EnrichModal({ onClose, hasProfile }: { onClose: () => void; hasProfile: boolean }) {
  const questions = useEnrichQuestionsMutation()
  const apply = useEnrichApplyMutation()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ changes: string[]; addedSkills: string[] } | null>(null)

  const items: EnrichQuestion[] = questions.data?.questions ?? []
  const askRef = useRef(questions.mutate)
  askRef.current = questions.mutate

  // Auto-fetch questions when the modal opens.
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    applyAnswers()
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
          {questions.isPending ? <p className="muted">Looking at your profile for gaps…</p> : null}
          {!hasProfile && items.length === 0 && !questions.isPending ? (
            <p className="muted">Tip: paste your CV or add a few skills first — the questions get sharper.</p>
          ) : null}
          {questions.isError ? <ErrorNotice error={questions.error} /> : null}

          {result ? (
            <div className="notice enrich-result">
              <h3>✓ Profile updated</h3>
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

function LanguagesSection({ languages }: { languages: Skill[] }) {
  const createSkill = useCreateSkillMutation()
  const updateSkill = useUpdateSkillMutation()
  const deleteSkill = useDeleteSkillMutation()
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { name: string; level: string }>>({})

  useEffect(() => {
    setDrafts(Object.fromEntries(languages.map((lang) => [lang.id, { name: lang.name, level: lang.level ?? '' }])))
  }, [languages])

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim().length === 0) return
    createSkill.mutate(
      { name: name.trim(), kind: 'LANGUAGE', level: nullIfEmpty(level), source: 'MANUAL' },
      { onSuccess: () => { setName(''); setLevel('') } },
    )
  }

  return (
    <section className="profile-card profile-card-wide" aria-labelledby="languages-title">
      <div className="card-heading">
        <div>
          <h3 id="languages-title">Languages</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>Your German level is one of the biggest real-world filters in the German market.</p>
        </div>
      </div>
      <form className="compact-editor lang-editor" onSubmit={add}>
        <TextField label="Language" value={name} onChange={setName} placeholder="German" />
        <TextField label="Level" value={level} onChange={setLevel} placeholder="B2 / C1 / native" />
        <button type="submit" disabled={createSkill.isPending || name.trim().length === 0}>Add</button>
      </form>
      {createSkill.isError ? <ErrorNotice error={createSkill.error} /> : null}
      <div className="editor-list">
        {languages.length === 0 ? <p className="muted">No languages yet — add at least your German and English levels.</p> : null}
        {languages.map((lang) => {
          const draft = drafts[lang.id] ?? { name: lang.name, level: lang.level ?? '' }
          return (
            <form
              className="compact-editor lang-editor"
              key={lang.id}
              onSubmit={(event) => {
                event.preventDefault()
                updateSkill.mutate({ id: lang.id, input: { name: draft.name, kind: 'LANGUAGE', level: nullIfEmpty(draft.level), source: 'MANUAL' } })
              }}
            >
              <TextField label="Language" value={draft.name} onChange={(value) => setDrafts((c) => ({ ...c, [lang.id]: { ...draft, name: value } }))} />
              <TextField label="Level" value={draft.level} onChange={(value) => setDrafts((c) => ({ ...c, [lang.id]: { ...draft, level: value } }))} />
              <div className="row-actions">
                <button type="submit" disabled={updateSkill.isPending}>Save</button>
                <button type="button" className="secondary-button" onClick={() => deleteSkill.mutate(lang.id)}>Delete</button>
              </div>
            </form>
          )
        })}
      </div>
    </section>
  )
}

function EducationSection({ education }: { education: Education[] }) {
  const createEducation = useCreateEducationMutation()
  const updateEducation = useUpdateEducationMutation()
  const deleteEducation = useDeleteEducationMutation()
  const [newEducation, setNewEducation] = useState<EducationForm>(emptyEducationForm)
  const [drafts, setDrafts] = useState<Record<string, EducationForm>>({})

  useEffect(() => {
    setDrafts(Object.fromEntries(education.map((item) => [item.id, educationToForm(item)])))
  }, [education])

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createEducation.mutate(educationFormToInput(newEducation), { onSuccess: () => setNewEducation(emptyEducationForm) })
  }

  return (
    <section className="profile-card profile-card-wide" aria-labelledby="education-title">
      <div className="card-heading">
        <h3 id="education-title">Education</h3>
      </div>
      <form className="stacked-editor" onSubmit={add}>
        <EducationFields value={newEducation} onChange={setNewEducation} />
        <button type="submit" disabled={createEducation.isPending || newEducation.degree.trim().length === 0}>Add</button>
      </form>
      {createEducation.isError ? <ErrorNotice error={createEducation.error} /> : null}
      <div className="editor-list">
        {education.map((item) => {
          const draft = drafts[item.id] ?? educationToForm(item)
          return (
            <form
              className="stacked-editor"
              key={item.id}
              onSubmit={(event) => {
                event.preventDefault()
                updateEducation.mutate({ id: item.id, input: educationFormToInput(draft) })
              }}
            >
              <EducationFields value={draft} onChange={(next) => setDrafts((c) => ({ ...c, [item.id]: next }))} />
              <div className="row-actions">
                <button type="submit" disabled={updateEducation.isPending}>Save</button>
                <button type="button" className="secondary-button" onClick={() => deleteEducation.mutate(item.id)}>Delete</button>
              </div>
            </form>
          )
        })}
      </div>
      {updateEducation.isError ? <ErrorNotice error={updateEducation.error} /> : null}
      {deleteEducation.isError ? <ErrorNotice error={deleteEducation.error} /> : null}
    </section>
  )
}

function LinksSection({ links }: { links: Array<Record<string, unknown>> }) {
  const updateProfile = useUpdateProfileMutation()
  const [rows, setRows] = useState<Array<{ label: string; url: string }>>([])

  useEffect(() => {
    setRows(links.map((link) => ({ label: stringValue(link.label, ''), url: stringValue(link.url, '') })))
  }, [links])

  function save() {
    const cleaned = rows
      .filter((row) => row.url.trim().length > 0)
      .map((row) => ({ label: row.label.trim(), url: row.url.trim() }))
    updateProfile.mutate({ links: cleaned })
  }

  return (
    <section className="profile-card profile-card-wide" aria-labelledby="links-title">
      <div className="card-heading">
        <div>
          <h3 id="links-title">Links</h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>GitHub, portfolio, LinkedIn — strong signals of your work.</p>
        </div>
        <button type="button" onClick={save} disabled={updateProfile.isPending}>{updateProfile.isPending ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="editor-list">
        {rows.map((row, index) => (
          <div className="compact-editor lang-editor" key={index}>
            <TextField label="Label" value={row.label} onChange={(value) => setRows((c) => c.map((r, i) => (i === index ? { ...r, label: value } : r)))} placeholder="GitHub" />
            <TextField label="URL" value={row.url} onChange={(value) => setRows((c) => c.map((r, i) => (i === index ? { ...r, url: value } : r)))} placeholder="https://…" />
            <button type="button" className="secondary-button" onClick={() => setRows((c) => c.filter((_, i) => i !== index))}>Remove</button>
          </div>
        ))}
      </div>
      <div className="row-actions">
        <button type="button" className="secondary-button" onClick={() => setRows((c) => [...c, { label: '', url: '' }])}>Add link</button>
      </div>
      {updateProfile.isError ? <ErrorNotice error={updateProfile.error} /> : null}
    </section>
  )
}

function EducationFields({ value, onChange }: { value: EducationForm; onChange: (value: EducationForm) => void }) {
  return (
    <>
      <div className="field-grid">
        <TextField label="Degree" value={value.degree} onChange={(next) => onChange({ ...value, degree: next })} placeholder="B.Sc. Computer Science" />
        <TextField label="Institution" value={value.institution} onChange={(next) => onChange({ ...value, institution: next })} />
        <TextField label="Field of study" value={value.field_of_study} onChange={(next) => onChange({ ...value, field_of_study: next })} />
        <TextField label="Grade" value={value.grade} onChange={(next) => onChange({ ...value, grade: next })} placeholder="1.7" />
        <TextField label="Start (YYYY-MM)" value={value.start} onChange={(next) => onChange({ ...value, start: next })} placeholder="2014-10" />
        <TextField label="End (YYYY-MM)" value={value.end} onChange={(next) => onChange({ ...value, end: next })} placeholder="2018-09" />
      </div>
      <label>
        Notes
        <textarea value={value.summary} onChange={(event) => onChange({ ...value, summary: event.target.value })} rows={2} />
      </label>
    </>
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

function educationToForm(item: Education): EducationForm {
  return {
    degree: item.degree,
    institution: item.institution ?? '',
    field_of_study: item.field_of_study ?? '',
    start: item.start ?? '',
    end: item.end ?? '',
    grade: item.grade ?? '',
    summary: item.summary ?? '',
  }
}

function educationFormToInput(form: EducationForm): EducationInput {
  return {
    degree: form.degree.trim(),
    institution: nullIfEmpty(form.institution),
    field_of_study: nullIfEmpty(form.field_of_study),
    start: nullIfEmpty(form.start),
    end: nullIfEmpty(form.end),
    grade: nullIfEmpty(form.grade),
    summary: nullIfEmpty(form.summary),
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
