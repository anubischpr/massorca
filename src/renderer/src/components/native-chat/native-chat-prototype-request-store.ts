// The message waiting on the "How many prototypes?" card, one per chat composer. Memory only: a
// reload drops it and the draft, which was never cleared, still holds the text.
import type { NativeChatComposerImageAttachment } from './NativeChatComposerField'
import type { NativeChatComposerDraft } from './native-chat-composer-draft-storage'

export type NativeChatPrototypeAsk = {
  text: string
  attachments: readonly NativeChatComposerImageAttachment[]
  /** The draft the message was taken from; only what it held leaves the composer once sent. */
  sentFrom: NativeChatComposerDraft
  /** A keyword match, not a command: the card also offers "Not a prototype". */
  keyword: boolean
  /** The setting asks each time; the card says why it appeared. */
  settingAsks: boolean
  /** The count Settings makes the primary button. */
  defaultCount: number
  agentName: string
}

const asks = new Map<string, NativeChatPrototypeAsk>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export const nativeChatPrototypeAsks = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  read(scopeKey: string): NativeChatPrototypeAsk | undefined {
    return asks.get(scopeKey)
  },
  write(scopeKey: string, ask: NativeChatPrototypeAsk): void {
    asks.set(scopeKey, ask)
    notify()
  },
  /** Removes and returns the ask: an answer is taken once. */
  take(scopeKey: string): NativeChatPrototypeAsk | undefined {
    const ask = asks.get(scopeKey)
    if (ask) {
      asks.delete(scopeKey)
      notify()
    }
    return ask
  }
}
