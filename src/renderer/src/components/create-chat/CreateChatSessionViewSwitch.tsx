import { useEffect, useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { CreateChatSessionView } from './create-chat-selection'

const WOBBLE_MS = 500

type CreateChatSessionViewSwitchProps = {
  view: CreateChatSessionView
  onViewChange: (view: CreateChatSessionView) => void
}

/** Chat or Terminal. Chat lights the rainbow border on this switch; going back to Chat wobbles it once. */
export function CreateChatSessionViewSwitch({
  view,
  onViewChange
}: CreateChatSessionViewSwitchProps): React.JSX.Element {
  const [wobbling, setWobbling] = useState(false)
  const wobbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (wobbleTimer.current !== null) {
        clearTimeout(wobbleTimer.current)
      }
    }
  }, [])

  const pick = (next: CreateChatSessionView): void => {
    if (next === view) {
      return
    }
    onViewChange(next)
    if (next !== 'chat' || prefersReducedMotion()) {
      return
    }
    setWobbling(true)
    if (wobbleTimer.current !== null) {
      clearTimeout(wobbleTimer.current)
    }
    wobbleTimer.current = setTimeout(() => setWobbling(false), WOBBLE_MS)
  }

  return (
    <div
      className={cn(
        'chat-view-switch',
        view === 'chat' && 'chat-view-rainbow',
        wobbling && 'chat-view-wobble'
      )}
    >
      <div
        role="radiogroup"
        aria-label={translate('components.createChat.sessionViewAria', 'Session view')}
        className="flex gap-0.5 rounded-md bg-muted p-0.5"
      >
        <ViewOption
          label={translate('components.createChat.sessionViewChat', 'Chat')}
          checked={view === 'chat'}
          onSelect={() => pick('chat')}
        />
        <ViewOption
          label={translate('components.createChat.sessionViewTerminal', 'Terminal')}
          checked={view === 'terminal'}
          onSelect={() => pick('terminal')}
        />
      </div>
    </div>
  )
}

export function ViewOption({
  label,
  checked,
  onSelect
}: {
  label: string
  checked: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex h-5 items-center gap-1 rounded-sm px-2 text-xs font-medium text-muted-foreground',
        checked && 'bg-accent text-foreground'
      )}
    >
      {label}
    </button>
  )
}

// Why: the wobble is motion, so a reduced-motion user gets the relit border with no animation.
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
