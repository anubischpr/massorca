import { MessageSquarePlus, SquareSplitVertical, SquareTerminal } from 'lucide-react'
import { SessionBarAction as HeaderAction } from '../../app-shell/SessionBarAction'
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
  /** The switch to the terminal is underway; the button shows it and takes no further click. */
  terminalPending?: boolean
  onSplitRight: () => void
  summaryVisible: boolean
  onToggleSummary: () => void
}

function ChatSummaryIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-4"
      aria-hidden="true"
    >
      <circle cx="6" cy="7" r="3" />
      <path d="M13 7h8" />
      <circle cx="6" cy="17" r="3" />
      <path d="M13 17h8" />
    </svg>
  )
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
        'This agent cannot run in the terminal.'
      )
    case 'no-provider-session':
      return translate(
        'components.native-chat.toggle.terminalViewNoSession',
        "This chat's agent session cannot be opened in the terminal."
      )
  }
}

/** The chat session's actions, rendered into the session bar: hand-off, terminal view, split and summary. */
export function NativeChatStructuredPaneHeader({
  canHandOff,
  terminalView,
  onHandOff,
  onShowTerminal,
  terminalPending = false,
  onSplitRight,
  summaryVisible,
  onToggleSummary
}: NativeChatStructuredPaneHeaderProps): React.JSX.Element {
  const summaryLabel = summaryVisible
    ? translate('components.native-chat.summary.hide', 'Hide Chat summary')
    : translate('components.native-chat.summary.show', 'Show Chat summary')
  const handOffLabel = translate(
    'components.agentSessionContinuation.handOffToAnotherAgent',
    'Hand Off to Another Agent'
  )
  const showTerminalLabel =
    terminalView.enabled && terminalView.launch.mode === 'fresh'
      ? translate(
          'components.native-chat.toggle.startTerminal',
          'Start a new session in the terminal'
        )
      : translate('components.native-chat.toggle.showTerminal', 'Show terminal')
  const splitRightLabel = translate(
    'auto.components.terminal.pane.TerminalContextMenu.20e565d865',
    'Split Terminal Right'
  )
  return (
    <div data-native-chat-pane-header="true" className="flex shrink-0 items-center gap-1">
      <HeaderAction
        label={handOffLabel}
        icon={<MessageSquarePlus />}
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
        icon={<SquareTerminal />}
        {...(terminalView.enabled
          ? {}
          : { disabledReason: terminalViewBlockText(terminalView.reason) })}
        pending={terminalPending}
        onClick={onShowTerminal}
      />
      <HeaderAction label={splitRightLabel} icon={<SquareSplitVertical />} onClick={onSplitRight} />
      <HeaderAction
        label={summaryLabel}
        icon={<ChatSummaryIcon />}
        pressed={summaryVisible}
        onClick={onToggleSummary}
      />
    </div>
  )
}
