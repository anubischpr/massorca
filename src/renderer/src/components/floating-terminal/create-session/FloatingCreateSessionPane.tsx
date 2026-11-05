import { useState } from 'react'
import { CreateChatSession } from '@/components/create-chat/CreateChatSession'
import { submitCreateChatDraft } from '@/components/create-chat/create-chat-submit'
import type { CreateChatSubmit } from '@/components/create-chat/create-chat-selection'
import { useCreateChatOptions } from '@/components/create-chat/use-create-chat-options'
import { translate } from '@/i18n/i18n'
import {
  clearFloatingCreateLaunch,
  markFloatingCreateLaunchStarted,
  useFloatingCreateLaunchStore
} from '@/lib/floating-workspace-create-launch'
import { useFloatingHostSelection } from '../host/use-floating-host-selection'
import { floatingCreateChatSelection } from './floating-create-session-selection'

/** The New Session tab's body: the create screen, which its session replaces in the floating workspace once it starts. */
export function FloatingCreateSessionPane({ tabId }: { tabId: string }): React.JSX.Element {
  const options = useCreateChatOptions()
  const { selectedHost, remoteWorkspaceId } = useFloatingHostSelection()
  // Why: each New Session tab starts a blank draft, preselected with the host and workspace in focus.
  const [initialSelection] = useState(() =>
    floatingCreateChatSelection(options, { selectedHost, remoteWorkspaceId })
  )
  const starting = useFloatingCreateLaunchStore((state) => state.startingTabIds[tabId] === true)
  const submitInFloatingWorkspace: CreateChatSubmit = async (draft, selection) => {
    markFloatingCreateLaunchStarted(tabId)
    const outcome = await submitCreateChatDraft(draft, selection, {
      kind: 'floating-workspace',
      createTabId: tabId
    })
    if (!outcome.started) {
      clearFloatingCreateLaunch(tabId)
    }
    return outcome
  }

  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col bg-background"
      data-floating-create-session
    >
      {starting ? (
        <div
          role="status"
          className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          {translate('components.floatingWorkspace.createStarting', 'Starting the session...')}
        </div>
      ) : null}
      {/* Why hidden, not unmounted: a start that fails brings the draft back as the person left it. */}
      <div className={starting ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <CreateChatSession
          options={options}
          initialSelection={initialSelection}
          onSubmit={submitInFloatingWorkspace}
        />
      </div>
    </div>
  )
}
