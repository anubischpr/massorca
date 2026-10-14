import type { IncrementalNdjsonFramer } from '../../shared/main-process-ndjson-framer'
import type {
  ManagedProviderProcess,
  ProviderProcessExit
} from '../provider-process/managed-provider-process'

export function asAntigravityError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export type AntigravityStreamFailureOptions = {
  process: ManagedProviderProcess
  framer: IncrementalNdjsonFramer
  rejectReady: (error: Error) => void
  rejectPending: (error: Error) => void
  hasPending: () => boolean
  onError: (error: Error) => void
  onExit?: (exit: ProviderProcessExit) => void
}

export class AntigravityStreamFailure {
  error: Error | null = null

  constructor(private readonly options: AntigravityStreamFailureOptions) {}

  handleExit(exit: ProviderProcessExit): void {
    try {
      this.options.onExit?.(exit)
    } catch {
      // Exit observers cannot change the provider's result.
    }
    if (!this.error && this.options.hasPending()) {
      this.fail(
        new Error(
          `Antigravity process exited without a terminal result (code=${String(exit.code)}, signal=${String(exit.signal)})`
        )
      )
    }
  }

  fail(error: Error): void {
    if (this.error) {
      return
    }
    this.error = error
    this.options.framer.reset()
    this.options.rejectReady(error)
    this.options.rejectPending(error)
    try {
      this.options.onError(error)
    } catch {
      // Observers cannot keep an invalid provider process alive.
    }
    void this.options.process.terminateTree().catch(() => {})
  }
}
