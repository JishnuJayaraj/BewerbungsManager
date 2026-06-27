import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
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
  useDeleteApplicationMutation,
  usePatchApplicationMutation,
  useProfileQuery,
  useUpdateProfileMutation,
  type Application,
  type ApplicationStatus,
} from '../api'
import { ghostThreshold, isGoneQuiet } from '../lib/funnel'

type ColumnDefinition = { status: ApplicationStatus; label: string }
type ActiveBoard = Record<string, Application[]>

const activeColumns: ColumnDefinition[] = [
  { status: 'SAVED', label: 'Saved' },
  { status: 'APPLIED', label: 'Applied' },
  { status: 'INTERVIEW', label: 'Interviewing' },
  { status: 'OFFER', label: 'Offer' },
]

const archiveStatuses: ApplicationStatus[] = ['REJECTED', 'GHOSTED', 'CLOSED']
const archiveLabels: Record<string, string> = { REJECTED: 'Rejected', GHOSTED: 'Ghosted', CLOSED: 'Closed' }

export function BoardPage() {
  const applications = useApplicationsQuery()
  const profile = useProfileQuery()
  const patch = usePatchApplicationMutation()
  const remove = useDeleteApplicationMutation()
  const updateProfile = useUpdateProfileMutation()
  const navigate = useNavigate()
  const [board, setBoard] = useState<ActiveBoard>(emptyActiveBoard())
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const threshold = ghostThreshold(profile.data)
  const allItems = (applications.data?.items ?? []).map((application) => ({
    ...application,
    gone_quiet: isGoneQuiet(application, threshold),
  }))

  function setThreshold(days: number) {
    updateProfile.mutate({ preferences: { ...(profile.data?.preferences ?? {}), ghost_threshold_days: days } })
  }

  useEffect(() => {
    setBoard(groupActive(allItems))
  }, [applications.data])

  const byId = useMemo(
    () => Object.fromEntries(allItems.map((application) => [application.id, application])),
    [allItems],
  )
  const archived = useMemo(
    () => allItems.filter((application) => archiveStatuses.includes(application.status)),
    [allItems],
  )
  const activeCount = allItems.filter((application) => application.is_active).length

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) return
    const activeStatus = findStatus(board, activeId)
    const targetStatus = isActiveStatus(overId) ? overId : findStatus(board, overId)
    if (!activeStatus || !targetStatus || !byId[activeId]) return

    const next = moveCard(board, activeId, targetStatus, overId)
    setBoard(next)
    const boardOrder = next[targetStatus].findIndex((application) => application.id === activeId)
    patch.mutate({ id: activeId, input: { status: targetStatus, board_order: boardOrder } })
  }

  function setStatus(application: Application, status: ApplicationStatus) {
    patch.mutate({ id: application.id, input: { status } })
  }

  function confirmRemove(application: Application) {
    if (!window.confirm(`Remove "${application.job_title || 'this role'}" from your board?`)) return
    remove.mutate(application.id)
  }

  return (
    <section className="board-layout" aria-labelledby="board-title">
      <div className="section-heading board-heading">
        <div>
          <p className="eyebrow">Board</p>
          <h2 id="board-title">Your pipeline</h2>
          <p className="section-copy">{activeCount} active · {archived.length} archived. Drag to move, or open a card to work on it.</p>
        </div>
        <div className="board-controls">
          <label className="ghost-threshold">
            Gone quiet after
            <input
              type="number"
              min={3}
              max={120}
              value={threshold}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value >= 3) setThreshold(Math.round(value))
              }}
            />
            days
          </label>
          <Link className="cta-link cta-link-quiet" to="/search">+ Add from search</Link>
        </div>
      </div>

      {applications.isError ? <ErrorNotice error={applications.error} /> : null}
      {patch.isError ? <ErrorNotice error={patch.error} /> : null}
      {!applications.isPending && allItems.length === 0 ? (
        <div className="notice board-empty">No applications yet. <Link to="/search">Discover roles and bookmark jobs →</Link></div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="kanban-columns kanban-active">
          {activeColumns.map((column) => (
            <ActiveColumn
              key={column.status}
              column={column}
              applications={board[column.status]}
              onOpen={(id) => navigate(`/workspace/${id}`)}
              onRemove={confirmRemove}
              onSetStatus={setStatus}
            />
          ))}
        </div>
      </DndContext>

      <ArchiveSection
        archived={archived}
        onOpen={(id) => navigate(`/workspace/${id}`)}
        onRemove={confirmRemove}
        onSetStatus={setStatus}
      />
    </section>
  )
}

function ActiveColumn({
  column,
  applications,
  onOpen,
  onRemove,
  onSetStatus,
}: {
  column: ColumnDefinition
  applications: Application[]
  onOpen: (id: string) => void
  onRemove: (application: Application) => void
  onSetStatus: (application: Application, status: ApplicationStatus) => void
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
            <ActiveCard
              key={application.id}
              application={application}
              onOpen={() => onOpen(application.id)}
              onRemove={() => onRemove(application)}
              onSetStatus={onSetStatus}
            />
          ))}
          {applications.length === 0 ? <p className="kanban-empty muted">Nothing here yet.</p> : null}
        </div>
      </SortableContext>
    </section>
  )
}

function ActiveCard({
  application,
  onOpen,
  onRemove,
  onSetStatus,
}: {
  application: Application
  onOpen: () => void
  onRemove: () => void
  onSetStatus: (application: Application, status: ApplicationStatus) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: application.id })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }
  const [menuOpen, setMenuOpen] = useState(false)
  const quiet = application.gone_quiet

  function act(fn: () => void) {
    setMenuOpen(false)
    fn()
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={['kanban-card', quiet ? 'kanban-card-quiet' : '', isDragging ? 'kanban-card-dragging' : ''].filter(Boolean).join(' ')}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <div className="kanban-card-menu" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" className="kanban-kebab" aria-label="Card actions" onClick={() => setMenuOpen((open) => !open)}>⋯</button>
        {menuOpen ? (
          <div className="kebab-menu" role="menu">
            {application.status === 'SAVED' ? (
              <button type="button" onClick={() => act(() => onSetStatus(application, 'APPLIED'))}>✓ Mark applied</button>
            ) : null}
            <button type="button" onClick={() => act(() => onSetStatus(application, 'REJECTED'))}>Move to Rejected</button>
            <button type="button" onClick={() => act(() => onSetStatus(application, 'GHOSTED'))}>Move to Ghosted</button>
            <button type="button" onClick={() => act(() => onSetStatus(application, 'CLOSED'))}>Move to Closed</button>
            <button type="button" className="kebab-danger" onClick={() => act(onRemove)}>Remove</button>
          </div>
        ) : null}
      </div>

      <strong className="kanban-card-title">{application.job_title || 'Untitled role'}</strong>
      <span className="kanban-card-company">{application.company ?? 'Company not listed'}</span>
      {application.next_action ? <span className="kanban-card-action">→ {application.next_action}</span> : null}
      {application.followup_date ? <span className="kanban-card-followup">📅 {application.followup_date}</span> : null}

      {quiet ? (
        <div className="quiet-nudge" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
          <span className="quiet-badge">😶 Gone quiet · {application.days_since_applied}d</span>
          <div className="quiet-actions">
            <button type="button" onClick={onOpen}>Follow up</button>
            <button type="button" className="secondary-button" onClick={() => onSetStatus(application, 'GHOSTED')}>Give up</button>
          </div>
        </div>
      ) : (
        <span className="kanban-card-open">Open →</span>
      )}
    </article>
  )
}

function ArchiveSection({
  archived,
  onOpen,
  onRemove,
  onSetStatus,
}: {
  archived: Application[]
  onOpen: (id: string) => void
  onRemove: (application: Application) => void
  onSetStatus: (application: Application, status: ApplicationStatus) => void
}) {
  if (archived.length === 0) return null
  const counts = archiveStatuses.map((status) => ({
    status,
    count: archived.filter((application) => application.status === status).length,
  }))

  return (
    <details className="board-accordion archive-accordion">
      <summary>
        <span>Archive</span>
        <span className="archive-counts">
          {counts.filter((entry) => entry.count > 0).map((entry) => (
            <span className="archive-count" key={entry.status}>{archiveLabels[entry.status]} {entry.count}</span>
          ))}
        </span>
      </summary>
      <div className="archive-list">
        {archived.map((application) => (
          <div className="archive-row" key={application.id}>
            <button type="button" className="archive-open" onClick={() => onOpen(application.id)}>
              <strong>{application.job_title || 'Untitled role'}</strong>
              <span>{application.company ?? 'Company not listed'}</span>
            </button>
            <span className={`status-pill archive-pill-${application.status.toLowerCase()}`}>{archiveLabels[application.status]}</span>
            <button type="button" className="link-toggle" onClick={() => onSetStatus(application, 'SAVED')}>Reopen</button>
            <button type="button" className="archive-remove" aria-label="Delete" onClick={() => onRemove(application)}>×</button>
          </div>
        ))}
      </div>
    </details>
  )
}

function ErrorNotice({ error }: { error: Error }) {
  return (
    <div className="notice notice-error" role="alert">
      {error instanceof ApiError ? `${error.status} ${error.code}: ${error.message}` : error.message}
    </div>
  )
}

function emptyActiveBoard(): ActiveBoard {
  return { SAVED: [], APPLIED: [], INTERVIEW: [], OFFER: [] }
}

function groupActive(applications: Application[]): ActiveBoard {
  const board = emptyActiveBoard()
  for (const application of applications) {
    if (application.status in board) {
      board[application.status].push(application)
    }
  }
  for (const status of Object.keys(board)) {
    board[status].sort((a, b) => a.board_order - b.board_order)
  }
  return board
}

function findStatus(board: ActiveBoard, id: string): ApplicationStatus | null {
  for (const status of Object.keys(board)) {
    if (board[status].some((application) => application.id === id)) return status as ApplicationStatus
  }
  return null
}

function isActiveStatus(value: string): value is ApplicationStatus {
  return activeColumns.some((column) => column.status === value)
}

function moveCard(board: ActiveBoard, activeId: string, targetStatus: ApplicationStatus, overId: string): ActiveBoard {
  const next = Object.fromEntries(Object.entries(board).map(([status, items]) => [status, [...items]])) as ActiveBoard
  let moved: Application | null = null
  for (const status of Object.keys(next)) {
    const index = next[status].findIndex((application) => application.id === activeId)
    if (index !== -1) {
      moved = { ...next[status][index], status: targetStatus }
      next[status].splice(index, 1)
      break
    }
  }
  if (!moved) return board
  const targetList = next[targetStatus]
  const overIndex = targetList.findIndex((application) => application.id === overId)
  if (overIndex === -1) targetList.push(moved)
  else targetList.splice(overIndex, 0, moved)
  return next
}
