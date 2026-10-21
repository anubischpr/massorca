import { GENTLE_SHELL_USAGE_PRESENTATION } from '../../shared/gentle-shell-usage-presentation'
import { agentSessionFailureWords } from '../../shared/agent-session-failure-words'
import type { ProviderTimelineEvent } from '../native-chat/agent-session-timeline/provider-timeline-event'
import type { JsonlRpcRecord } from '../jsonl-rpc/peer'
import type { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import { piRpcFailureFact } from './rpc-prompt-delivery'
import { piRpcNoticeSchema } from './rpc-protocol'

// Slash commands whose output is a terminal-only panel, which Pi cannot draw over RPC.
const TERMINAL_PANEL_COMMANDS = new Set(['gentle:usage', 'gentle:commands', 'gentle:changes', 'history'])
const MAX_HELD_NOTICES = 32
const MAX_NOTICE_CHARS = 8000

type Notice = { tone: 'notice' | 'warning' | 'error'; text: string; presentation?: string }

/** Shows Pi `notify` output (what slash commands print) as rows of the turn that ran them. */
export class PiRpcNotices {
  private held: Notice[] = []
  private flushed = 0
  private count = 0
  constructor(
    private readonly lane: JsonlRpcTimelineLane,
    /** The open turn's id, when a turn can take the row now. */
    private readonly activeTurn: () => string | undefined,
    /** Whether a prompt awaits its reply, so its turn is about to open. */
    private readonly promptPending: () => boolean
  ) {}

  receive(frame: JsonlRpcRecord): void {
    const parsed = piRpcNoticeSchema.safeParse(frame)
    if (!parsed.success || parsed.data.message.trim() === '') {
      return
    }
    const { message, notifyType } = parsed.data
    const notice: Notice = {
      tone: notifyType === 'warning' ? 'warning' : notifyType === 'error' ? 'error' : 'notice',
      text: message.slice(0, MAX_NOTICE_CHARS)
    }
    if (this.activeTurn()) {
      this.show([notice])
    } else if (this.promptPending() && this.held.length < MAX_HELD_NOTICES) {
      this.held.push(notice)
    }
  }

  /** Called once the held prompt's turn is open. */
  flush(): void {
    this.flushed = this.held.length
    this.show(this.held)
    this.held = []
  }

  /** A handled panel command that printed nothing would otherwise leave the chat silent. */
  panelOnly(message: unknown): void {
    const name = typeof message === 'string' ? /^\/(\S+)/.exec(message)?.[1] : undefined
    if (name && TERMINAL_PANEL_COMMANDS.has(name) && this.flushed === 0) {
      this.show([
        {
          tone: 'notice',
          ...(name === 'gentle:usage' ? { presentation: GENTLE_SHELL_USAGE_PRESENTATION } : {}),
          text: `/${name} opens a panel that only the Gentle Shell terminal can draw, so it shows nothing here. Run it in the terminal.`
        }
      ])
    }
  }

  private show(notices: readonly Notice[]): void {
    const turn = this.activeTurn()
    if (!turn || notices.length === 0) {
      return
    }
    this.lane.apply(
      notices.map((notice) => ({
        type: 'item.close' as const,
        item: `notice:${turn}:${this.count++}`,
        body: { kind: 'status' as const, ...notice }
      }))
    )
  }
}

/** The row that tells a person why the turn Pi ran failed. */
export function piRpcFailureEvent(turn: string, failure: string): ProviderTimelineEvent {
  return {
    type: 'item.close',
    item: `error:${turn}`,
    body: {
      kind: 'status',
      tone: 'error',
      ...agentSessionFailureWords(piRpcFailureFact(failure), { agentName: 'Pi', surface: 'row' })
    }
  }
}
