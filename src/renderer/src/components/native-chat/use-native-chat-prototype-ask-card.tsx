import { useCallback, useSyncExternalStore } from 'react'
import { NativeChatPrototypeCountCard } from './NativeChatPrototypeCountCard'
import { NativeChatPrototypeSystemCard } from './NativeChatPrototypeSystemCard'
import type { NativeChatPrototypeChoice } from '../../../../shared/prototype-request-decision'
import type { PrototypeDesignSystemMode } from '../../../../shared/prototype-design-system-files'
import type { NativeChatComposerImageAttachment } from './NativeChatComposerField'
import type { NativeChatComposerDraft } from './native-chat-composer-draft-storage'
import { nativeChatPrototypeAsks } from './native-chat-prototype-request-store'
import { openPrototypeDesignSystem } from '../prototypes/open-prototype-design-system'

/** The composer's send, which an answer uses too, so the queue hold applies to it as to any message. */
export type NativeChatPrototypeAnswerSend = (
  text: string,
  attachments: readonly NativeChatComposerImageAttachment[],
  sentFrom: NativeChatComposerDraft,
  choice: NativeChatPrototypeChoice
) => void

/**
 * The card a message held for prototypes waits on: "How many prototypes?", then the design system card once the
 * count is settled. Each answer sends that message through `send`; "Review first" opens the design system and
 * leaves the card up.
 */
export function useNativeChatPrototypeAskCard({
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
  const chooseDesignSystem = useCallback(
    (designSystem: PrototypeDesignSystemMode) => {
      const waiting = nativeChatPrototypeAsks.read(draftScopeKey)
      if (waiting?.designSystem) {
        send(waiting.text, waiting.attachments, waiting.sentFrom, {
          count: waiting.designSystem.count,
          designSystem
        })
      }
    },
    [draftScopeKey, send]
  )
  const reviewDesignSystem = useCallback(() => {
    const waiting = nativeChatPrototypeAsks.read(draftScopeKey)
    if (waiting?.designSystem) {
      openPrototypeDesignSystem(waiting.designSystem.card.projectKey)
    }
  }, [draftScopeKey])
  if (ask === undefined) {
    return null
  }
  if (ask.designSystem === undefined) {
    return <NativeChatPrototypeCountCard ask={ask} onChoose={choose} />
  }
  return (
    <NativeChatPrototypeSystemCard
      card={ask.designSystem.card}
      count={ask.designSystem.count}
      agentName={ask.agentName}
      onChoose={chooseDesignSystem}
      onReview={reviewDesignSystem}
    />
  )
}
