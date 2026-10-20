import type { AgentSessionPromptResponse } from '../../shared/agent-session-question-answer'
import {
  AgentSessionPromptAnswerRejectedError,
  AgentSessionPromptUnavailableError
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import type { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import type { JsonlRpcRecord } from '../jsonl-rpc/peer'
import { piRpcDialogPresentation, type PiRpcDialogPresentation } from './rpc-extension-dialogs'
import { piRpcDialogSchema } from './rpc-protocol'
import { nextToggleReply, type ToggleScript } from './rpc-toggle-select-rounds'

type Callback = { presentation: PiRpcDialogPresentation; claimed: boolean; bytes: number }
const DECORATION = new Set(['notify', 'setStatus', 'setWidget', 'setTitle', 'setEditorText'])

export class PiRpcDialogCallbacks {
  private readonly pending = new Map<string, Callback>()
  private pendingBytes = 0
  private readonly deadlines = new Map<string, NodeJS.Timeout>()
  private script: ToggleScript | null = null
  constructor(
    private readonly lane: JsonlRpcTimelineLane,
    private readonly send: (frame: JsonlRpcRecord) => Promise<void>,
    private readonly onFailed: (error: Error) => void
  ) {}

  private post(frame: JsonlRpcRecord): void {
    void this.send(frame).catch((error: unknown) =>
      this.onFailed(error instanceof Error ? error : new Error(String(error)))
    )
  }

  /** Answers the next toggle round of a multi-select the user already answered. */
  private answerScriptedRound(frame: JsonlRpcRecord): boolean {
    const script = this.script
    if (!script) {
      return false
    }
    const parsed = piRpcDialogSchema.safeParse(frame)
    const reply =
      parsed.success && parsed.data.method === 'select'
        ? nextToggleReply(script, parsed.data.title, parsed.data.options)
        : null
    if (!parsed.success || !reply) {
      this.script = null
      return false
    }
    if (reply.last) {
      this.script = null
    }
    this.post({ type: 'extension_ui_response', id: parsed.data.id, value: reply.value })
    return true
  }

  receive(frame: JsonlRpcRecord): void {
    if (typeof frame.method === 'string' && DECORATION.has(frame.method)) {
      return
    }
    if (this.answerScriptedRound(frame)) {
      return
    }
    const presentation = piRpcDialogPresentation(frame)
    if (!presentation) {
      if (typeof frame.id === 'string' || typeof frame.id === 'number') {
        this.post({ type: 'extension_ui_response', id: frame.id, cancelled: true })
      }
      return
    }
    const key = String(presentation.id)
    const bytes = Buffer.byteLength(JSON.stringify(presentation.body))
    if (
      this.pending.has(key) ||
      this.pending.size >= 64 ||
      this.pendingBytes + bytes > 8 * 1024 * 1024
    ) {
      throw new Error('Pi dialog identity or capacity violation')
    }
    this.pending.set(key, { presentation, claimed: false, bytes })
    this.pendingBytes += bytes
    this.lane.apply([{ type: 'request.open', request: key, body: presentation.body }])
    if (presentation.timeoutMs !== undefined) {
      this.deadlines.set(
        key,
        setTimeout(() => this.expire(key), presentation.timeoutMs).unref()
      )
    }
  }

  /** Pi already resolved this dialog on its own deadline, so no answer is owed. */
  private expire(key: string): void {
    const callback = this.pending.get(key)
    this.deadlines.delete(key)
    if (!callback || callback.claimed) {
      return
    }
    this.forget(key, callback)
    this.lane.apply([{ type: 'request.withdrawn', request: key }])
  }

  private forget(key: string, callback: Callback): void {
    clearTimeout(this.deadlines.get(key))
    this.deadlines.delete(key)
    this.pending.delete(key)
    this.pendingBytes -= callback.bytes
  }

  async respond(
    itemId: string,
    response: AgentSessionPromptResponse | null,
    commit: () => Promise<void>,
    answer = true
  ): Promise<void> {
    const entry = [...this.pending].find(([key]) => this.lane.isRequestRow(itemId, key))
    if (!entry || entry[1].claimed) {
      throw new AgentSessionPromptUnavailableError(itemId)
    }
    const [key, callback] = entry
    let reply: Record<string, unknown>
    try {
      reply = callback.presentation.reply(response)
    } catch (error) {
      throw new AgentSessionPromptAnswerRejectedError(
        error instanceof Error ? error.message : 'Invalid Pi dialog answer'
      )
    }
    callback.claimed = true
    try {
      await commit()
      if (this.pending.get(key) !== callback) {
        throw new AgentSessionPromptUnavailableError(itemId)
      }
      if (answer) {
        this.script = response ? (callback.presentation.script?.(response) ?? null) : null
        await this.send({ type: 'extension_ui_response', id: callback.presentation.id, ...reply })
      }
      this.forget(key, callback)
    } catch (error) {
      this.script = null
      callback.claimed = false
      throw error
    }
  }

  cancelAll(): void {
    this.script = null
    for (const deadline of this.deadlines.values()) {
      clearTimeout(deadline)
    }
    this.deadlines.clear()
    for (const [key, callback] of this.pending) {
      this.lane.apply([{ type: 'request.withdrawn', request: key }])
      void this.send({
        type: 'extension_ui_response',
        id: callback.presentation.id,
        cancelled: true
      }).catch(() => {})
    }
    this.pending.clear()
    this.pendingBytes = 0
  }
}
