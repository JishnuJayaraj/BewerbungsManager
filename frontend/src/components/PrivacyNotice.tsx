import { ApiError, useSettingsQuery } from '../api'

export function PrivacyNotice() {
  const settings = useSettingsQuery()

  if (settings.isPending) {
    return (
      <section className="privacy-strip" aria-label="Privacy notice">
        Loading privacy settings...
      </section>
    )
  }

  if (settings.isError) {
    return (
      <section className="privacy-strip privacy-warning" aria-label="Privacy notice">
        Privacy settings could not be loaded: {settings.error instanceof ApiError ? settings.error.code : 'request_error'}.
      </section>
    )
  }

  return (
    <section className="privacy-strip" aria-label="Privacy notice">
      <strong>{settings.data.llm_provider}</strong> is the active LLM provider. CV and job text may
      be sent to the configured provider during generation; the EU provider is the default.
    </section>
  )
}
