import { useCallback } from 'react'
import type { StructuredAgentId } from '../../../src/shared/agent-session-provider-handle'
import { neutralizePrototypeMarkers } from '../../../src/shared/prototype-hidden-instruction'
import type { NativeChatPrototypeChoice } from '../../../src/shared/prototype-request-decision'
import { isStructuredAgentSessionComposerCommand } from '../../../src/shared/structured-agent-session-composer'
import type {
  MobilePrototypeSendInput,
  MobilePrototypeSendResolution
} from '../prototypes/use-mobile-native-chat-prototype-outgoing'
import type { MobileNativeChatSendOutcome } from './mobile-native-chat-send'
import type { MobileNativeChatSendOrigin } from './use-mobile-native-chat-drafts'

type StructuredNativeChatAttachment = {
  id?: string
  path: string
  previewUri: string
}

export function useMobileStructuredNativeChatSendBridge(args: {
  agent: StructuredAgentId | undefined
  sendStructured: (
    text: string,
    images?: string[],
    deadline?: number,
    attachments?: readonly StructuredNativeChatAttachment[]
  ) => Promise<MobileNativeChatSendOutcome>
  captureSendOrigin: (text: string) => MobileNativeChatSendOrigin | null
  clearDraftForSend: (origin: MobileNativeChatSendOrigin, text: string) => void
  acceptSend: (origin: MobileNativeChatSendOrigin, text: string, images?: string[]) => void
  holdUnconfirmedSend: (
    origin: MobileNativeChatSendOrigin,
    text: string,
    onUnconfirmed: () => void
  ) => void
  restoreRejectedDraft: (origin: MobileNativeChatSendOrigin, text: string) => void
  onSendError: (message: string) => void
  /** Plans text that may ask for prototypes; absent, every message goes as typed. */
  resolvePrototype?: (input: MobilePrototypeSendInput) => Promise<MobilePrototypeSendResolution>
}): {
  send: (text: string, images?: string[]) => Promise<boolean>
  sendWithOutcome: (
    text: string,
    images?: string[],
    deadline?: number,
    attachments?: readonly StructuredNativeChatAttachment[],
    prototypeChoice?: NativeChatPrototypeChoice
  ) => Promise<MobileNativeChatSendOutcome>
} {
  const {
    acceptSend,
    agent,
    captureSendOrigin,
    clearDraftForSend,
    holdUnconfirmedSend,
    onSendError,
    resolvePrototype,
    restoreRejectedDraft,
    sendStructured
  } = args
  const sendWithOutcome = useCallback(
    async (
      draftText: string,
      images?: string[],
      deadline?: number,
      attachments?: readonly StructuredNativeChatAttachment[],
      prototypeChoice?: NativeChatPrototypeChoice
    ): Promise<MobileNativeChatSendOutcome> => {
      // Markers in typed or pasted text are never MassOrca's; the draft keeps exactly what was typed.
      const text = neutralizePrototypeMarkers(draftText)
      const origin = captureSendOrigin(text.trimEnd())
      if (!origin) {
        onSendError('Message not sent (disconnected)')
        return 'rejected'
      }
      const isHostCommand = isStructuredAgentSessionComposerCommand(draftText, agent)
      let wireText = text
      // A host command is never a prototype request; any other text may be one.
      if (!isHostCommand && resolvePrototype) {
        const planned = await resolvePrototype({
          text: draftText,
          ...(images ? { images } : {}),
          ...(attachments ? { attachments } : {}),
          ...(prototypeChoice ? { choice: prototypeChoice } : {})
        })
        // Held for the card's answer: the draft stays where it is and nothing goes out now.
        if (planned.kind === 'held') {
          return 'queued'
        }
        wireText = planned.wireText
      }
      clearDraftForSend(origin, draftText)
      const outcome =
        attachments !== undefined
          ? await sendStructured(wireText, images, deadline, attachments)
          : deadline !== undefined
            ? await sendStructured(wireText, images, deadline)
            : images !== undefined
              ? await sendStructured(wireText, images)
              : await sendStructured(wireText)
      if (outcome === 'accepted') {
        if (!isHostCommand) {
          acceptSend(origin, text.trimEnd(), images)
        }
        return 'accepted'
      }
      if (outcome === 'queued') {
        // The host holds the draft and publishes it as a card above the
        // composer — never an optimistic transcript bubble.
        return 'queued'
      }
      if (outcome === 'unknown') {
        if (isHostCommand) {
          restoreRejectedDraft(origin, draftText)
          return 'unknown'
        }
        holdUnconfirmedSend(origin, text.trimEnd(), () =>
          onSendError('Delivery unconfirmed — check chat before retrying')
        )
        return 'unknown'
      }
      restoreRejectedDraft(origin, draftText)
      return 'rejected'
    },
    [
      acceptSend,
      agent,
      captureSendOrigin,
      clearDraftForSend,
      holdUnconfirmedSend,
      onSendError,
      resolvePrototype,
      restoreRejectedDraft,
      sendStructured
    ]
  )
  const send = useCallback(
    async (
      text: string,
      images?: string[],
      deadline?: number,
      attachments?: readonly StructuredNativeChatAttachment[]
    ) => (await sendWithOutcome(text, images, deadline, attachments)) !== 'rejected',
    [sendWithOutcome]
  )
  return { send, sendWithOutcome }
}
