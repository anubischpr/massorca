import { useCallback, useSyncExternalStore } from 'react'
import { NativeChatPrototypeCountCard } from './NativeChatPrototypeCountCard'
import type { NativeChatPrototypeChoice } from '../../../../shared/prototype-request-decision'
import type { NativeChatComposerImageAttachment } from './NativeChatComposerField'
import type { NativeChatComposerDraft } from './native-chat-composer-draft-storage'
import { nativeChatPrototypeAsks } from './native-chat-prototype-request-store'

/** The composer's send, which an answer uses too, so the queue hold applies to it as to any message. */
export type NativeChatPrototypeAnswerSend = (
  text: string,
  attachments: readonly NativeChatComposerImageAttachment[],
  sentFrom: NativeChatComposerDraft,
  choice: NativeChatPrototypeChoice
) => void

/** The "How many prototypes?" card of a message held for it; its answer sends that message through `send`. */
export function useNativeChatPrototypeCountCard({
  draftScopeKey,
  send
}: {
  draftScopeKey: string
  send: NativeChatPrototypeAnswerSend
}): React.JSX.Element | null {
  const ask = useSyncExternalStore(nativeChatPrototypeAsks.subscribe, () =>
    nativeChatPrototypeAsks.read(draftScopeKey)
  )
  const choose = useCallback(
    (choice: NativeChatPrototypeChoice) => {
      // Read, not taken: the send takes the card once its message goes out, and gives it back if not.
      const waiting = nativeChatPrototypeAsks.read(draftScopeKey)
      if (waiting) {
        send(waiting.text, waiting.attachments, waiting.sentFrom, choice)
      }
    },
    [draftScopeKey, send]
  )
  return ask ? <NativeChatPrototypeCountCard ask={ask} onChoose={choose} /> : null
}
