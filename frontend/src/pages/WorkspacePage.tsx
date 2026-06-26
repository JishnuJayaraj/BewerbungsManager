import { useParams } from 'react-router'
import { PlaceholderPage } from '../shared/PlaceholderPage'

export function WorkspacePage() {
  const { applicationId } = useParams()

  return (
    <PlaceholderPage
      eyebrow="Workspace"
      title={applicationId ? `Application ${applicationId}` : 'Select an application'}
      copy="Workspace placeholder."
    />
  )
}
