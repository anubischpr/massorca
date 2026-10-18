import type { ReactNode } from 'react'
import { MessageSquarePlus, SquareSplitVertical, SquareTerminal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type {
  StructuredChatTerminalViewBlock,
  StructuredChatTerminalViewState
} from './structured-chat-terminal-view'

export type NativeChatStructuredPaneHeaderProps = {
  canHandOff: boolean
  terminalView: StructuredChatTerminalViewState
  onHandOff: () => void
  onShowTerminal: () => void
  onSplitRight: () => void
  onClose: () => void
}

function terminalViewBlockText(reason: StructuredChatTerminalViewBlock): string {
  switch (reason) {
    case 'no-worktree':
      return translate(
        'components.native-chat.toggle.terminalViewNoWorktree',
        "This chat's workspace is not known yet."
      )
    case 'agent':
      return translate(
        'components.native-chat.toggle.terminalViewAgent',
        'This agent cannot resume its chat in the terminal.'
      )
    case 'no-provider-session':
      return translate(
        'components.native-chat.toggle.terminalViewNoSession',
        'This chat has not reported its agent session yet.'
      )
  }
}

function HeaderAction({
  label,
  icon,
  disabledReason,
  onClick
}: {
  label: string
  icon: ReactNode
  /** Set when the action cannot run; the tooltip then says why. */
  disabledReason?: string
  onClick: () => void
}): React.JSX.Element {
  const disabled = disabledReason !== undefined
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {icon}
    </Button>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Why: a disabled button swallows pointer events, so the focusable wrapper carries the tooltip. */}
        {disabled ? (
          <span tabIndex={0} className="inline-flex">
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {disabled ? (
          <span className="flex flex-col gap-0.5">
            <span>{label}</span>
            <span className="text-muted-foreground">{disabledReason}</span>
          </span>
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** The chat pane's own actions, matching the terminal pane header's hand-off, view, split and close. */
export function NativeChatStructuredPaneHeader({
  canHandOff,
  terminalView,
  onHandOff,
  onShowTerminal,
  onSplitRight,
  onClose
}: NativeChatStructuredPaneHeaderProps): React.JSX.Element {
  const handOffLabel = translate(
    'components.agentSessionContinuation.handOffToAnotherAgent',
    'Hand Off to Another Agent'
  )
  const showTerminalLabel = translate('components.native-chat.toggle.showTerminal', 'Show terminal')
  const splitRightLabel = translate(
    'auto.components.terminal.pane.TerminalContextMenu.20e565d865',
    'Split Terminal Right'
  )
  const closeLabel = translate('auto.components.tab.bar.SortableTab.95db5f2f7d', 'Close tab')
  return (
    <div
      data-native-chat-pane-header="true"
      className="flex h-8 shrink-0 items-center justify-end gap-0.5 border-b border-border px-2"
    >
      <HeaderAction
        label={handOffLabel}
        icon={<MessageSquarePlus className="size-3" />}
        {...(canHandOff
          ? {}
          : {
              disabledReason: translate(
                'components.agentSessionContinuation.handOffUnavailable',
                'This agent cannot start a new session from its chat.'
              )
            })}
        onClick={onHandOff}
      />
      <HeaderAction
        label={showTerminalLabel}
        icon={<SquareTerminal className="size-3" />}
        {...(terminalView.enabled
          ? {}
          : { disabledReason: terminalViewBlockText(terminalView.reason) })}
        onClick={onShowTerminal}
      />
      <HeaderAction
        label={splitRightLabel}
        icon={<SquareSplitVertical className="size-3" />}
        onClick={onSplitRight}
      />
      <HeaderAction label={closeLabel} icon={<X className="size-3" />} onClick={onClose} />
    </div>
  )
}
