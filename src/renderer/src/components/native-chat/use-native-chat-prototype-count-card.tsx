import { useCallback, useSyncExternalStore } from 'react'
import { NativeChatPrototypeCountCard } from './NativeChatPrototypeCountCard'
import type { NativeChatPrototypeChoice } from './native-chat-prototype-request-decision'
import { nativeChatPrototypeAsks } from './native-chat-prototype-request-store'
import {
  useNativeChatStructuredComposerSend,
  type UseNativeChatStructuredComposerSendArgs
} from './use-native-chat-structured-composer-send'

/** The "How many prototypes?" card of a message held for it, and its answer, which sends it. */
export function useNativeChatPrototypeCountCard(
  args: UseNativeChatStructuredComposerSendArgs
): React.JSX.Element | null {
  const { draftScopeKey } = args
  const ask = useSyncExternalStore(nativeChatPrototypeAsks.subscribe, () =>
    nativeChatPrototypeAsks.read(draftScopeKey)
  )
  const send = useNativeChatStructuredComposerSend(args)
  const choose = useCallback(
    (choice: NativeChatPrototypeChoice) => {
      const taken = nativeChatPrototypeAsks.take(draftScopeKey)
      if (taken) {
        void send(taken.text, taken.attachments, taken.sentFrom, choice)
      }
    },
    [draftScopeKey, send]
  )
  return ask ? <NativeChatPrototypeCountCard ask={ask} onChoose={choose} /> : null
}
