import { ShieldAlert } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { createChatTerminalBlock } from './create-chat-selection'

type CreateChatTerminalNoticeProps = {
  /** Set when the agent cannot run in the terminal; the notice then names that instead. */
  block: ReturnType<typeof createChatTerminalBlock>
}

/** Below the composer in terminal view: what the terminal view leaves out, or why it cannot open. */
export function CreateChatTerminalNotice({
  block
}: CreateChatTerminalNoticeProps): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-lg border border-status-warning-border bg-status-warning-background px-3 py-2.5 text-sm leading-6"
    >
      <ShieldAlert className="mt-1 size-4 shrink-0 text-status-warning" />
      {block ? (
        <p>
          {translate(
            'components.native-chat.toggle.terminalViewAgent',
            'This agent cannot run in the terminal.'
          )}
        </p>
      ) : (
        <p>
          <strong className="font-semibold">
            {translate(
              'components.createChat.terminalNoticeLead',
              "Terminal view uses the agent's own interface."
            )}
          </strong>{' '}
          {translate(
            'components.createChat.terminalNoticeBody',
            'These will not be available in this session: Chat summary (Results, Subagents, Connectors, Background tasks) and the chat composer.'
          )}
        </p>
      )}
    </div>
  )
}
