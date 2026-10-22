import type { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import type { PiRpcContextUsage } from './rpc-context-usage'
import { piRpcStateSchema, type PiRpcModel } from './rpc-protocol'

/** Keeps the timeline's model and context-usage report in step with what Pi says it is running. */
export class PiRpcUsageSync {
  constructor(
    readonly context: PiRpcContextUsage,
    private readonly deps: {
      lane: Pick<JsonlRpcTimelineLane, 'apply'>
      request: (command: string) => Promise<unknown>
      diagnostic?: (error: unknown) => void
      ended: () => boolean
    }
  ) {}

  /** Records the live model; a real change clears the old report, so read the new one at once. */
  syncModel(model: PiRpcModel | undefined, force = false): void {
    const changed = this.context.modelChanged(model)
    this.deps.lane.apply(this.context.setModel(model, Date.now()))
    if (changed || force) {
      this.refresh()
    }
  }

  /** Re-reads the live model and usage; a failed read leaves the last report in place. */
  async resync(force = false): Promise<void> {
    try {
      const state = piRpcStateSchema.parse(await this.deps.request('get_state'))
      this.syncModel(state.model ?? undefined, force)
    } catch (error) {
      this.deps.diagnostic?.(error)
    }
  }

  refresh(): void {
    void this.deps
      .request('get_session_stats')
      .then((value) => {
        if (!this.deps.ended()) {
          this.deps.lane.apply(this.context.stats(value, Date.now()))
        }
      })
      .catch((error: unknown) => this.deps.diagnostic?.(error))
  }
}
