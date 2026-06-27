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

/** Where a "Reopen" sends each archived/dormant state. */
function reopenTarget(status: ApplicationStatus): ApplicationStatus {
  return status === 'GHOSTED' ? 'APPLIED' : 'SAVED'
}

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
  const allItems = useMemo(
    () => (applications.data?.items ?? []).map((a) => ({ ...a, gone_quiet: isGoneQuiet(a, threshold) })),
    [applications.data, threshold],
  )

  useEffect(() => {
    setBoard(groupActive(allItems))
  }, [allItems])

  const byId = useMemo(() => Object.fromEntries(allItems.map((a) => [a.id, a])), [allItems])
  const awaiting = useMemo(
    () => allItems.filter((a) => a.status === 'GHOSTED').sort((a, b) => (b.days_since_applied ?? 0) - (a.days_since_applied ?? 0)),
    [allItems],
  )
  const rejected = useMemo(() => allItems.filter((a) => a.status === 'REJECTED'), [allItems])
  const closed = useMemo(() => allItems.filter((a) => a.status === 'CLOSED'), [allItems])

  const counts = {
    active: allItems.filter((a) => a.is_active).length,
    applied: allItems.filter((a) => a.status === 'APPLIED').length,
    interviewing: allItems.filter((a) => a.status === 'INTERVIEW').length,
    offers: allItems.filter((a) => a.status === 'OFFER').length,
    awaiting: awaiting.length,
    archived: rejected.length + closed.length,
  }

  function setThreshold(days: number) {
    updateProfile.mutate({ preferences: { ...(profile.data?.preferences ?? {}), ghost_threshold_days: days } })
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) return
    const activeStatus = findStatus(board, activeId)
    const targetStatus = isActiveStatus(overId) ? overId : findStatus(board, overId)
    if (!activeStatus || !targetStatus || !byId[activeId]) return
    const next = moveCard(board, activeId, targetStatus, overId)
    setBoard(next)
    const boardOrder = next[targetStatus].findIndex((a) => a.id === activeId)
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

      {allItems.length > 0 ? (
        <div className="funnel-bar">
          <FunnelStat label="Active" value={counts.active} />
          <FunnelStat label="Applied" value={counts.applied} />
          <FunnelStat label="Interviewing" value={counts.interviewing} tone="good" />
          <FunnelStat label="Offers" value={counts.offers} tone="good" />
          <FunnelStat label="Awaiting reply" value={counts.awaiting} tone="warn" />
          <FunnelStat label="Archived" value={counts.archived} muted />
        </div>
      ) : null}

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

      <AwaitingSection
        items={awaiting}
        onOpen={(id) => navigate(`/workspace/${id}`)}
        onSetStatus={setStatus}
        onRemove={confirmRemove}
      />

      <ArchiveSection
        rejected={rejected}
        closed={closed}
        onOpen={(id) => navigate(`/workspace/${id}`)}
        onSetStatus={setStatus}
        onRemove={confirmRemove}
      />
    </section>
  )
}

function FunnelStat({ label, value, tone, muted }: { label: string; value: number; tone?: 'good' | 'warn'; muted?: boolean }) {
  return (
    <div className={['funnel-stat', tone ? `funnel-${tone}` : '', muted ? 'funnel-muted' : ''].filter(Boolean).join(' ')}>
      <span className="funnel-value">{value}</span>
      <span className="funnel-label">{label}</span>
    </div>
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
      <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
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
            <button type="button" title="They said no" onClick={() => act(() => onSetStatus(application, 'REJECTED'))}>Rejected (they said no)</button>
            <button type="button" title="No reply — recoverable" onClick={() => act(() => onSetStatus(application, 'GHOSTED'))}>Ghosted (no reply)</button>
            <button type="button" title="You ended it" onClick={() => act(() => onSetStatus(application, 'CLOSED'))}>Closed (you ended it)</button>
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

function AwaitingSection({
  items,
  onOpen,
  onSetStatus,
  onRemove,
}: {
  items: Application[]
  onOpen: (id: string) => void
  onSetStatus: (application: Application, status: ApplicationStatus) => void
  onRemove: (application: Application) => void
}) {
  if (items.length === 0) return null
  return (
    <details className="board-accordion awaiting-accordion" open>
      <summary>
        <span>😶 Awaiting reply</span>
        <span className="awaiting-hint muted">{items.length} ghosted · may still come back</span>
      </summary>
      <div className="archive-list">
        {items.map((application) => (
          <div className="archive-row awaiting-row" key={application.id}>
            <button type="button" className="archive-open" onClick={() => onOpen(application.id)}>
              <strong>{application.job_title || 'Untitled role'}</strong>
              <span>{application.company ?? 'Company not listed'}</span>
            </button>
            <span className="awaiting-age">{application.days_since_applied != null ? `${application.days_since_applied}d silent` : ''}</span>
            <button type="button" className="link-toggle" onClick={() => onSetStatus(application, 'APPLIED')}>Reopen</button>
            <button type="button" className="link-toggle" onClick={() => onSetStatus(application, 'CLOSED')}>Close</button>
            <button type="button" className="archive-remove" aria-label="Delete" onClick={() => onRemove(application)}>×</button>
          </div>
        ))}
      </div>
    </details>
  )
}

function ArchiveSection({
  rejected,
  closed,
  onOpen,
  onSetStatus,
  onRemove,
}: {
  rejected: Application[]
  closed: Application[]
  onOpen: (id: string) => void
  onSetStatus: (application: Application, status: ApplicationStatus) => void
  onRemove: (application: Application) => void
}) {
  const [query, setQuery] = useState('')
  const total = rejected.length + closed.length
  if (total === 0) return null

  const match = (a: Application) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${a.job_title} ${a.company ?? ''}`.toLowerCase().includes(q)
  }
  const rej = rejected.filter(match)
  const cls = closed.filter(match)

  return (
    <details className="board-accordion archive-accordion">
      <summary>
        <span>Archive</span>
        <span className="archive-counts">
          {rejected.length > 0 ? <span className="archive-count">Rejected {rejected.length}</span> : null}
          {closed.length > 0 ? <span className="archive-count">Closed {closed.length}</span> : null}
        </span>
      </summary>
      <div className="archive-body">
        {total > 6 ? (
          <input className="archive-search" placeholder="Search archive…" value={query} onChange={(event) => setQuery(event.target.value)} />
        ) : null}
        <ArchiveGroup label="Rejected — they said no" items={rej} onOpen={onOpen} onSetStatus={onSetStatus} onRemove={onRemove} />
        <ArchiveGroup label="Closed — you ended it" items={cls} onOpen={onOpen} onSetStatus={onSetStatus} onRemove={onRemove} />
        {rej.length === 0 && cls.length === 0 ? <p className="muted" style={{ padding: '8px 10px' }}>No matches.</p> : null}
      </div>
    </details>
  )
}

function ArchiveGroup({
  label,
  items,
  onOpen,
  onSetStatus,
  onRemove,
}: {
  label: string
  items: Application[]
  onOpen: (id: string) => void
  onSetStatus: (application: Application, status: ApplicationStatus) => void
  onRemove: (application: Application) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="archive-group">
      <h4 className="archive-group-title">{label} <span>{items.length}</span></h4>
      <div className="archive-list">
        {items.map((application) => (
          <div className="archive-row" key={application.id}>
            <button type="button" className="archive-open" onClick={() => onOpen(application.id)}>
              <strong>{application.job_title || 'Untitled role'}</strong>
              <span>{application.company ?? 'Company not listed'}</span>
            </button>
            <button type="button" className="link-toggle" onClick={() => onSetStatus(application, reopenTarget(application.status))}>Reopen</button>
            <button type="button" className="archive-remove" aria-label="Delete" onClick={() => onRemove(application)}>×</button>
          </div>
        ))}
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

function emptyActiveBoard(): ActiveBoard {
  return { SAVED: [], APPLIED: [], INTERVIEW: [], OFFER: [] }
}

function groupActive(applications: Application[]): ActiveBoard {
  const board = emptyActiveBoard()
  for (const application of applications) {
    if (application.status in board) board[application.status].push(application)
  }
  for (const status of Object.keys(board)) {
    if (status === 'APPLIED') {
      // surface the ones needing a follow-up: gone-quiet first, then oldest applied
      board[status].sort((a, b) =>
        Number(b.gone_quiet) - Number(a.gone_quiet) || (b.days_since_applied ?? 0) - (a.days_since_applied ?? 0),
      )
    } else {
      board[status].sort((a, b) => a.board_order - b.board_order)
    }
  }
  return board
}

function findStatus(board: ActiveBoard, id: string): ApplicationStatus | null {
  for (const status of Object.keys(board)) {
    if (board[status].some((a) => a.id === id)) return status as ApplicationStatus
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
    const index = next[status].findIndex((a) => a.id === activeId)
    if (index !== -1) {
      moved = { ...next[status][index], status: targetStatus }
      next[status].splice(index, 1)
      break
    }
  }
  if (!moved) return board
  const targetList = next[targetStatus]
  const overIndex = targetList.findIndex((a) => a.id === overId)
  if (overIndex === -1) targetList.push(moved)
  else targetList.splice(overIndex, 0, moved)
  return next
}
