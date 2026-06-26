import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ApiError,
  useApplicationsQuery,
  usePatchApplicationMutation,
  type Application,
  type ApplicationPatch,
  type ApplicationStatus,
} from '../api'
import { ChecklistSummary, CommsLogPanel, PackageChecklistPanel } from '../components/ApplicationPanels'

type ColumnDefinition = {
  status: ApplicationStatus
  label: string
}

type BoardColumns = Record<ApplicationStatus, Application[]>

type CardForm = {
  next_action: string
  followup_date: string
  needs_followup: boolean
}

const columns: ColumnDefinition[] = [
  { status: 'SAVED', label: 'Saved' },
  { status: 'APPLIED', label: 'Applied' },
  { status: 'INTERVIEW', label: 'Interview' },
  { status: 'OFFER', label: 'Offer' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: 'CLOSED', label: 'Closed' },
]

export function BoardPage() {
  const applications = useApplicationsQuery()
  const patchApplication = usePatchApplicationMutation()
  const [board, setBoard] = useState<BoardColumns>(emptyBoard())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (applications.data) {
      setBoard(groupApplications(applications.data.items))
      setSelectedId((current) => current ?? applications.data.items[0]?.id ?? null)
    }
  }, [applications.data])

  const applicationsById = useMemo(() => {
    return Object.fromEntries(Object.values(board).flat().map((application) => [application.id, application]))
  }, [board])

  const selectedApplication = selectedId ? applicationsById[selectedId] : null

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) {
      return
    }

    const activeStatus = findStatusForApplication(board, activeId)
    const targetStatus = isApplicationStatus(overId)
      ? overId
      : findStatusForApplication(board, overId)
    if (!activeStatus || !targetStatus) {
      return
    }

    const activeApplication = applicationsById[activeId]
    if (!activeApplication) {
      return
    }

    const next = moveApplication(board, activeId, targetStatus, overId)
    setBoard(next)

    const boardOrder = next[targetStatus].findIndex((application) => application.id === activeId)
    patchApplication.mutate({
      id: activeId,
      input: {
        status: targetStatus,
        board_order: boardOrder,
      },
    })
  }

  return (
    <section className="board-layout" aria-labelledby="board-title">
      <div className="section-heading board-heading">
        <div>
          <p className="eyebrow">Board</p>
          <h2 id="board-title">Application board</h2>
        </div>
        <Link className="nav-link" to="/search">Add from search</Link>
      </div>

      {applications.isPending ? <p className="muted">Loading applications...</p> : null}
      {applications.isError ? <ErrorNotice error={applications.error} /> : null}
      {patchApplication.isError ? <ErrorNotice error={patchApplication.error} /> : null}

      <div className="board-grid">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="kanban-columns">
            {columns.map((column) => (
              <KanbanColumn
                key={column.status}
                column={column}
                applications={board[column.status]}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </DndContext>

        <aside className="board-detail">
          {selectedApplication ? (
            <BoardDetail application={selectedApplication} />
          ) : (
            <section className="board-detail-card">
              <h3>Card detail</h3>
              <p className="muted">Select a card to edit follow-up, comms, and checklist.</p>
            </section>
          )}
        </aside>
      </div>
    </section>
  )
}

function KanbanColumn({
  column,
  applications,
  selectedId,
  onSelect,
}: {
  column: ColumnDefinition
  applications: Application[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status })

  return (
    <section ref={setNodeRef} className={isOver ? 'kanban-column kanban-column-over' : 'kanban-column'}>
      <div className="kanban-column-header">
        <h3>{column.label}</h3>
        <span>{applications.length}</span>
      </div>
      <SortableContext items={applications.map((application) => application.id)} strategy={verticalListSortingStrategy}>
        <div className="kanban-card-list">
          {applications.map((application) => (
            <KanbanCard
              key={application.id}
              application={application}
              selected={application.id === selectedId}
              onSelect={() => onSelect(application.id)}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

function KanbanCard({
  application,
  selected,
  onSelect,
}: {
  application: Application
  selected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        'kanban-card',
        selected ? 'kanban-card-selected' : '',
        isDragging ? 'kanban-card-dragging' : '',
      ].filter(Boolean).join(' ')}
    >
      <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label="Drag card">
        Drag
      </button>
      <button type="button" className="kanban-card-body" onClick={onSelect}>
        <strong>{application.job_title || 'Untitled role'}</strong>
        <span>{application.company ?? 'Company not listed'}</span>
        {application.next_action ? <em>{application.next_action}</em> : <small>No next action</small>}
        {application.followup_date ? <small>Follow up {application.followup_date}</small> : null}
      </button>
      <ChecklistSummary applicationId={application.id} />
    </article>
  )
}

function BoardDetail({ application }: { application: Application }) {
  const patchApplication = usePatchApplicationMutation()

  return (
    <div className="board-detail-stack">
      <section className="board-detail-card">
        <div className="card-heading">
          <div>
            <h3>{application.job_title}</h3>
            <p className="muted">{application.company ?? 'Company not listed'}</p>
          </div>
          <Link className="nav-link" to={`/workspace/${application.id}`}>Workspace</Link>
        </div>
        <NextActionForm
          application={application}
          saving={patchApplication.isPending}
          error={patchApplication.error}
          onSave={(input) => patchApplication.mutate({ id: application.id, input })}
        />
      </section>
      <PackageChecklistPanel applicationId={application.id} compact />
      <CommsLogPanel applicationId={application.id} compact />
    </div>
  )
}

function NextActionForm({
  application,
  saving,
  error,
  onSave,
}: {
  application: Application
  saving: boolean
  error: Error | null
  onSave: (input: ApplicationPatch) => void
}) {
  const [form, setForm] = useState<CardForm>(() => cardForm(application))

  useEffect(() => {
    setForm(cardForm(application))
  }, [application])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave({
      next_action: nullIfEmpty(form.next_action),
      followup_date: nullIfEmpty(form.followup_date),
      needs_followup: form.needs_followup,
    })
  }

  return (
    <form className="next-action-form" onSubmit={submit}>
      <label>
        Next action
        <input
          value={form.next_action}
          onChange={(event) => setForm({ ...form, next_action: event.target.value })}
        />
      </label>
      <div className="field-grid">
        <label>
          Follow-up date
          <input
            type="date"
            value={form.followup_date}
            onChange={(event) => setForm({ ...form, followup_date: event.target.value })}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.needs_followup}
            onChange={(event) => setForm({ ...form, needs_followup: event.target.checked })}
          />
          Needs follow-up
        </label>
      </div>
      <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save next action'}</button>
      {error ? <ErrorNotice error={error} /> : null}
    </form>
  )
}

function groupApplications(applications: Application[]): BoardColumns {
  const grouped = emptyBoard()
  for (const application of applications) {
    grouped[application.status].push(application)
  }
  for (const status of Object.keys(grouped) as ApplicationStatus[]) {
    grouped[status].sort((a, b) => a.board_order - b.board_order || b.created_at.localeCompare(a.created_at))
  }
  return grouped
}

function emptyBoard(): BoardColumns {
  return {
    SAVED: [],
    APPLIED: [],
    INTERVIEW: [],
    OFFER: [],
    REJECTED: [],
    CLOSED: [],
  }
}

function moveApplication(board: BoardColumns, activeId: string, targetStatus: ApplicationStatus, overId: string) {
  const next = cloneBoard(board)
  const sourceStatus = findStatusForApplication(next, activeId)
  if (!sourceStatus) {
    return next
  }

  const sourceItems = next[sourceStatus]
  const activeIndex = sourceItems.findIndex((application) => application.id === activeId)
  const [activeApplication] = sourceItems.splice(activeIndex, 1)
  const targetItems = next[targetStatus]
  const rawOverIndex = isApplicationStatus(overId)
    ? targetItems.length
    : targetItems.findIndex((application) => application.id === overId)
  const overIndex = rawOverIndex === -1 ? targetItems.length : rawOverIndex
  targetItems.splice(overIndex, 0, {
    ...activeApplication,
    status: targetStatus,
    board_order: overIndex,
  })
  return next
}

function cloneBoard(board: BoardColumns): BoardColumns {
  return {
    SAVED: [...board.SAVED],
    APPLIED: [...board.APPLIED],
    INTERVIEW: [...board.INTERVIEW],
    OFFER: [...board.OFFER],
    REJECTED: [...board.REJECTED],
    CLOSED: [...board.CLOSED],
  }
}

function findStatusForApplication(board: BoardColumns, applicationId: string): ApplicationStatus | null {
  return columns.find((column) => board[column.status].some((application) => application.id === applicationId))?.status ?? null
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return columns.some((column) => column.status === value)
}

function cardForm(application: Application): CardForm {
  return {
    next_action: application.next_action ?? '',
    followup_date: application.followup_date ?? '',
    needs_followup: application.needs_followup,
  }
}

function ErrorNotice({ error }: { error: Error }) {
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
