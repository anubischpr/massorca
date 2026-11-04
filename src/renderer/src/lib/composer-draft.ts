import { useCallback, useState, useSyncExternalStore } from 'react'
import { subscribeToNativeChatComposerDraft } from '@/components/native-chat/native-chat-composer-draft-store'
import {
  readNativeChatDraftCache,
  writeNativeChatDraftCache
} from '@/components/native-chat/native-chat-draft-cache'

/** Unsent text of a composer that is not a chat pane (`create`, `tasks`, `room:<teamId>`), kept in
 *  the chat draft store so it survives the composer unmounting, a reload and a quit. */
export function composerDraftScopeKey(key: string): string {
  return `composer:${key}`
}

const noSubscription = (): (() => void) => () => {}

/** `[draft, setDraft, clearDraft]` for one composer; clear it once the message is sent.
 *  A null key holds the text only while the composer is mounted. */
export function useComposerDraft(
  key: string | null
): [string, (text: string) => void, () => void] {
  const scopeKey = key === null ? null : composerDraftScopeKey(key)
  const [localDraft, setLocalDraft] = useState('')
  const subscribe = useCallback(
    (listener: () => void) =>
      scopeKey === null ? noSubscription() : subscribeToNativeChatComposerDraft(scopeKey, listener),
    [scopeKey]
  )
  const stored = useSyncExternalStore(subscribe, () =>
    scopeKey === null ? '' : readNativeChatDraftCache(scopeKey)
  )
  const setDraft = useCallback(
    (text: string) => {
      if (scopeKey === null) {
        setLocalDraft(text)
      } else {
        writeNativeChatDraftCache(scopeKey, text)
      }
    },
    [scopeKey]
  )
  const clearDraft = useCallback(() => setDraft(''), [setDraft])
  return [scopeKey === null ? localDraft : stored, setDraft, clearDraft]
}
