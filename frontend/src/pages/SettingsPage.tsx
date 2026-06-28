import { ApiError, useSettingsQuery } from '../api'

export function SettingsPage() {
  const settings = useSettingsQuery()

  return (
    <section className="page-section" aria-labelledby="settings-title">
      <div className="section-heading">
        <p className="eyebrow">Settings</p>
        <h2 id="settings-title">Privacy and provider</h2>
      </div>

      {settings.isPending ? (
        <p className="muted loading-pulse">Loading settings...</p>
      ) : settings.isError ? (
        <div className="notice notice-error" role="alert">
          {settings.error instanceof ApiError
            ? `${settings.error.status} ${settings.error.code}: ${settings.error.message}`
            : settings.error.message}
        </div>
      ) : (
        <div className="settings-grid">
          <dl className="definition-list">
            <div>
              <dt>Active provider</dt>
              <dd>{settings.data.llm_provider}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{settings.data.single_user ? 'Single user, local-first' : 'Multi-user'}</dd>
            </div>
          </dl>
          <article className="notice">
            <h3>GDPR notice</h3>
            <p>{settings.data.gdpr_notice}</p>
          </article>
        </div>
      )}
    </section>
  )
}
