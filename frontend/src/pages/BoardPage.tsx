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
  type Application,
  type ApplicationStatus,
} from '../api'

type ColumnDefinition = { status: ApplicationStatus; label: string }
type BoardColumns = Record<ApplicationStatus, Application[]>

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
  const deleteApplication = useDeleteApplicationMutation()
  const navigate = useNavigate()
  const [board, setBoard] = useState<BoardColumns>(emptyBoard())
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (applications.data) {
      setBoard(groupApplications(applications.data.items))
    }
  }, [applications.data])

  const applicationsById = useMemo(
    () => Object.fromEntries(Object.values(board).flat().map((application) => [application.id, application])),
    [board],
  )

  const total = Object.values(board).flat().length

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) return

    const activeStatus = findStatusForApplication(board, activeId)
    const targetStatus = isApplicationStatus(overId) ? overId : findStatusForApplication(board, overId)
    if (!activeStatus || !targetStatus) return
    if (!applicationsById[activeId]) return

    const next = moveApplication(board, activeId, targetStatus, overId)
    setBoard(next)
    const boardOrder = next[targetStatus].findIndex((application) => application.id === activeId)
    patchApplication.mutate({ id: activeId, input: { status: targetStatus, board_order: boardOrder } })
  }

  function remove(application: Application) {
    if (!window.confirm(`Remove "${application.job_title || 'this role'}" from your board?`)) return
    deleteApplication.mutate(application.id)
  }

  return (
    <section className="board-layout" aria-labelledby="board-title">
      <div className="section-heading board-heading">
        <div>
          <p className="eyebrow">Board</p>
          <h2 id="board-title">Your applications</h2>
          <p className="section-copy">Drag a card to move it through your pipeline, or open one to craft and track it.</p>
        </div>
        <Link className="cta-link cta-link-quiet" to="/search">+ Add from search</Link>
      </div>

      {applications.isError ? <ErrorNotice error={applications.error} /> : null}
      {patchApplication.isError ? <ErrorNotice error={patchApplication.error} /> : null}
      {!applications.isPending && total === 0 ? (
        <div className="notice board-empty">
          No applications yet. <Link to="/search">Discover roles and bookmark jobs →</Link>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="kanban-columns">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              column={column}
              applications={board[column.status]}
              onOpen={(id) => navigate(`/workspace/${id}`)}
              onRemove={remove}
            />
          ))}
        </div>
      </DndContext>
    </section>
  )
}

function KanbanColumn({
  column,
  applications,
  onOpen,
  onRemove,
}: {
  column: ColumnDefinition
  applications: Application[]
  onOpen: (id: string) => void
  onRemove: (application: Application) => void
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
            <KanbanCard key={application.id} application={application} onOpen={() => onOpen(application.id)} onRemove={() => onRemove(application)} />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

function KanbanCard({
  application,
  onOpen,
  onRemove,
}: {
  application: Application
  onOpen: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: application.id })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={['kanban-card', isDragging ? 'kanban-card-dragging' : ''].filter(Boolean).join(' ')}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="kanban-card-remove"
        aria-label="Remove from board"
        title="Remove from board"
        onClick={(event) => { event.stopPropagation(); onRemove() }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        ×
      </button>
      <strong className="kanban-card-title">{application.job_title || 'Untitled role'}</strong>
      <span className="kanban-card-company">{application.company ?? 'Company not listed'}</span>
      {application.next_action ? <span className="kanban-card-action">→ {application.next_action}</span> : null}
      {application.followup_date ? <span className="kanban-card-followup">📅 {application.followup_date}</span> : null}
      <span className="kanban-card-open">Open workspace →</span>
    </article>
  )
}

function ErrorNotice({ error }: { error: Error }) {
  return (
    <div className="notice notice-error" role="alert">
      {error instanceof ApiError ? `${error.status} ${error.code}: ${error.message}` : error.message}
    </div>
  )
}

function emptyBoard(): BoardColumns {
  return { SAVED: [], APPLIED: [], INTERVIEW: [], OFFER: [], REJECTED: [], CLOSED: [] }
}

function groupApplications(applications: Application[]): BoardColumns {
  const board = emptyBoard()
  for (const application of applications) {
    board[application.status].push(application)
  }
  for (const status of Object.keys(board) as ApplicationStatus[]) {
    board[status].sort((a, b) => a.board_order - b.board_order)
  }
  return board
}

function findStatusForApplication(board: BoardColumns, id: string): ApplicationStatus | null {
  for (const status of Object.keys(board) as ApplicationStatus[]) {
    if (board[status].some((application) => application.id === id)) return status
  }
  return null
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return columns.some((column) => column.status === value)
}

function moveApplication(board: BoardColumns, activeId: string, targetStatus: ApplicationStatus, overId: string): BoardColumns {
  const next = Object.fromEntries(
    Object.entries(board).map(([status, items]) => [status, [...items]]),
  ) as BoardColumns

  let moved: Application | null = null
  for (const status of Object.keys(next) as ApplicationStatus[]) {
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
  if (overIndex === -1) {
    targetList.push(moved)
  } else {
    targetList.splice(overIndex, 0, moved)
  }
  return next
}
