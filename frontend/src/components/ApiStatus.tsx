import { ApiError, useHealthQuery } from '../api'

export function ApiStatus() {
  const health = useHealthQuery()

  return (
    <aside className="api-status" aria-label="Backend status">
      <span className={health.data?.status === 'ok' ? 'status-dot status-ok' : 'status-dot'} />
      <span>
        API{' '}
        {health.isPending
          ? 'checking'
          : health.isError
            ? formatError(health.error)
            : health.data.status}
      </span>
    </aside>
  )
}

function formatError(error: Error) {
  if (error instanceof ApiError) {
    return `${error.status} ${error.code}`
  }
  return 'unavailable'
}
