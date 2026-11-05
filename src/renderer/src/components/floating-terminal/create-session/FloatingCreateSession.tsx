import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { CreateChatSession } from '@/components/create-chat/CreateChatSession'
import { submitCreateChatDraft } from '@/components/create-chat/create-chat-submit'
import type { CreateChatSubmit } from '@/components/create-chat/create-chat-selection'
import { useCreateChatOptions } from '@/components/create-chat/use-create-chat-options'
import { useFloatingHostSelection } from '../host/use-floating-host-selection'
import { floatingCreateChatSelection } from './floating-create-session-selection'
import { useFloatingCreateSessionStore } from './floating-create-session-store'

/** The create screen drawn over the floating panel's canvas, while the panel asks for it. */
export function FloatingCreateSession(): React.JSX.Element | null {
  const open = useFloatingCreateSessionStore((state) => state.open)
  // Why unmounted when closed: each opening starts a blank draft with a fresh preselection.
  return open ? <FloatingCreateSessionCanvas /> : null
}

function closeFloatingCreateSession(): void {
  useFloatingCreateSessionStore.getState().setOpen(false)
}

const submitInFloatingWorkspace: CreateChatSubmit = async (draft, selection) => {
  const outcome = await submitCreateChatDraft(draft, selection, 'floating-workspace')
  if (outcome.started) {
    closeFloatingCreateSession()
  }
  return outcome
}

function FloatingCreateSessionCanvas(): React.JSX.Element {
  const options = useCreateChatOptions()
  const { selectedHost, remoteWorkspaceId } = useFloatingHostSelection()
  const [initialSelection] = useState(() =>
    floatingCreateChatSelection(options, { selectedHost, remoteWorkspaceId })
  )
  const closeLabel = translate('components.floatingWorkspace.closeNewSession', 'Close new session')

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Why the containment check: a chip menu's portal bubbles here too, and its Escape only closes it.
    const inCanvas = event.target instanceof Node && event.currentTarget.contains(event.target)
    if (event.key === 'Escape' && !event.defaultPrevented && inCanvas) {
      event.preventDefault()
      closeFloatingCreateSession()
    }
  }

  return (
    <div
      className="absolute inset-0 z-10 flex min-h-0 flex-col bg-background"
      data-floating-create-session
      onKeyDown={onKeyDown}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-2 right-2 z-10"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={closeFloatingCreateSession}
      >
        <X className="size-3.5" />
      </Button>
      <CreateChatSession
        options={options}
        initialSelection={initialSelection}
        onSubmit={submitInFloatingWorkspace}
      />
    </div>
  )
}
