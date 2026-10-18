import { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import type { NativeChatReplySuggestion } from '../../../../shared/native-chat-reply-suggestion'

/** What the composer draws as ghost text and answers Tab/Esc with. */
export type NativeChatReplySuggestionView = {
  text: string
  /** Hides this suggestion until the host publishes another; Esc and an accepted Tab both use it. */
  dismiss: () => void
}

const MAX_REMEMBERED_DISMISSALS = 128
// Outlives the composer, so a chat tab switched away from and back to does not offer it again.
const dismissedBySession = new Map<string, string>()

function suggestionKey(suggestion: NativeChatReplySuggestion): string {
  return `${suggestion.turnId}\n${suggestion.text}`
}

function rememberDismissal(sessionId: string, key: string): void {
  dismissedBySession.delete(sessionId)
  dismissedBySession.set(sessionId, key)
  if (dismissedBySession.size > MAX_REMEMBERED_DISMISSALS) {
    const oldest = dismissedBySession.keys().next()
    if (!oldest.done) {
      dismissedBySession.delete(oldest.value)
    }
  }
}

/**
 * The host's suggested next message for an idle chat, or null when it should not show. The
 * suggestion is the host's cached one for the latest turn: whether the draft is empty is the
 * composer's call, so typing and clearing show the same text again with no new request.
 */
export function useNativeChatReplySuggestion(args: {
  sessionId: string
  suggestion: NativeChatReplySuggestion | null
  /** No turn runs and none is about to: a suggestion never shows over live work. */
  idle: boolean
}): NativeChatReplySuggestionView | null {
  const { sessionId, suggestion, idle } = args
  const enabled = useAppStore((store) => store.settings?.nativeChatReplySuggestions !== false)
  const emulatedEnabled = useAppStore(
    (store) => store.settings?.nativeChatEmulatedReplySuggestions !== false
  )
  const [dismissed, setDismissed] = useState(() => dismissedBySession.get(sessionId) ?? null)
  const key = suggestion ? suggestionKey(suggestion) : null
  const dismiss = useCallback((): void => {
    if (key !== null) {
      rememberDismissal(sessionId, key)
      setDismissed(key)
    }
  }, [key, sessionId])
  return useMemo(
    () =>
      suggestion &&
      key !== dismissed &&
      enabled &&
      idle &&
      (suggestion.source === 'native' || emulatedEnabled)
        ? { text: suggestion.text, dismiss }
        : null,
    [dismiss, dismissed, emulatedEnabled, enabled, idle, key, suggestion]
  )
}
