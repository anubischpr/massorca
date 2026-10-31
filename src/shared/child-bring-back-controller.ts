import { ChildBringBackStatus } from './child-bring-back'

type ChildBringBackMethod =
  | 'delegation.bringBackStatus'
  | 'delegation.bringBack'
  | 'delegation.bringBackAbort'
  | 'delegation.bringBackResolve'

/** Calls the host; each client brings its own transport. */
export type ChildBringBackCall = (
  method: ChildBringBackMethod,
  params: { requestId: string }
) => Promise<unknown>

export type ChildBringBackSnapshot = {
  status: ChildBringBackStatus
  busy: boolean
  error: string | null
}

const POLL_MS = 10_000
// Why: a cold host can fail the first read, while an older host fails every one.
const MAX_FAILED_READS = 3

function pollsWhile(status: ChildBringBackStatus): boolean {
  // Conflicts and blocks clear outside this notice, in a terminal or Source Control.
  return (
    status.kind === 'conflicts' ||
    status.kind === 'running' ||
    (status.kind === 'ready' && status.block !== null)
  )
}

/** The notice's view of the host's state, free of React so each client binds it to its own copy. */
export class ChildBringBackController {
  private snapshot: ChildBringBackSnapshot = {
    status: { kind: 'unavailable' },
    busy: false,
    error: null
  }
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private failedReads = 0
  private started = false

  constructor(
    private readonly requestId: string,
    private readonly call: ChildBringBackCall
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): ChildBringBackSnapshot => this.snapshot

  /** Starts reading; the returned function stops it. */
  start = (): (() => void) => {
    this.started = true
    void this.read()
    return () => {
      this.started = false
      this.clearTimer()
    }
  }

  bringBack = (): void => this.act('delegation.bringBack')
  abort = (): void => this.act('delegation.bringBackAbort')
  resolve = (): void => this.act('delegation.bringBackResolve')

  private update(patch: Partial<ChildBringBackSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async read(): Promise<void> {
    this.clearTimer()
    let failed = false
    const status = await this.call('delegation.bringBackStatus', { requestId: this.requestId })
      .then((result) => ChildBringBackStatus.parse(result))
      .catch((): ChildBringBackStatus => {
        failed = true
        return { kind: 'unavailable' }
      })
    if (!this.started) {
      return
    }
    this.failedReads = failed ? this.failedReads + 1 : 0
    this.update({ status })
    if (pollsWhile(status) || (failed && this.failedReads < MAX_FAILED_READS)) {
      this.timer = setTimeout(() => void this.read(), POLL_MS)
    }
  }

  private act(method: ChildBringBackMethod): void {
    this.update({ busy: true, error: null })
    void this.call(method, { requestId: this.requestId })
      .catch((failure: unknown) => {
        this.update({ error: failure instanceof Error ? failure.message : String(failure) })
      })
      .then(() => this.read())
      .finally(() => this.update({ busy: false }))
  }
}
