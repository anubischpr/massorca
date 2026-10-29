// The message waiting on the "How many prototypes?" card, one per chat composer. Memory only: the
// draft was never cleared, so a reload loses the card and keeps the text.
import type { StructuredMobileSendAttachment } from '../session/use-mobile-structured-send-with-outcome'
import type { MobilePrototypeAskDetails } from './mobile-prototype-outgoing'

export type MobilePrototypeAsk = MobilePrototypeAskDetails & {
  /** The text as typed, which the composer draft still holds. */
  text: string
  images?: string[]
  attachments?: readonly StructuredMobileSendAttachment[]
  agentName: string
}

const asks = new Map<string, MobilePrototypeAsk>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export const mobilePrototypeAsks = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  read(scopeKey: string): MobilePrototypeAsk | undefined {
    return asks.get(scopeKey)
  },
  write(scopeKey: string, ask: MobilePrototypeAsk): void {
    asks.set(scopeKey, ask)
    notify()
  },
  /** Removes and returns the ask: an answer is taken once. */
  take(scopeKey: string): MobilePrototypeAsk | undefined {
    const ask = asks.get(scopeKey)
    if (ask) {
      asks.delete(scopeKey)
      notify()
    }
    return ask
  }
}
