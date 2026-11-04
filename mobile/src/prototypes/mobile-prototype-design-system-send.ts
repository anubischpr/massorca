// The send of the design system draft on mobile: one "Update the design system" message to the project's chat.
import {
  designSystemDraftCount,
  designSystemDraftGroups
} from '../../../src/shared/prototype-design-system-draft'
import { buildDesignSystemUpdateMessage } from '../../../src/shared/prototype-design-system-message'
import { designSystemRebuildSetsOf } from '../../../src/shared/prototype-design-system-rebuild'
import type { DesignSystemChat } from '../../../src/shared/prototype-design-system-view'
import {
  sendableDraftImages,
  sendAccepted,
  sendBegun,
  sendRefused,
  type DesignSystemSendKind,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import type { StructuredAgentSessionAttachment } from '../../../src/shared/structured-agent-session-send-mutation'
import type { RpcClient } from '../transport/rpc-client'
import { sendMobilePrototypeText } from './mobile-prototype-chat-text-send'
import { sendToStructuredSessionOnHost } from './mobile-prototype-host-chat-send'
import type { MobileDesignSystemPanelProps } from './mobile-prototype-design-system-props'

type DraftBase = Pick<MobileDesignSystemPanelProps, 'content' | 'state'>

/** How many changes the draft holds: the count the bar shows. */
export function mobileDesignSystemDraftCount({ content, state }: DraftBase): number {
  return designSystemDraftCount(
    { tokens: content.tokens, components: content.components },
    state.draft
  )
}

/** Whether Send would carry nothing: no change, no text and no image. */
export function mobileDesignSystemNothingToSend(panel: DraftBase): boolean {
  return (
    mobileDesignSystemDraftCount(panel) === 0 &&
    panel.state.freeText.trim() === '' &&
    panel.state.images.length === 0
  )
}

/** The draft's ready images as the chat takes them; the host reads only the path. */
function draftAttachmentsOf(state: DesignSystemViewState): StructuredAgentSessionAttachment[] {
  return sendableDraftImages(state).map((image) => ({
    ...image,
    previewUri: image.path
  }))
}

/** The text the draft sends: its groups, the rebuild line when the option is on, and the free text. */
export function mobileDesignSystemDraftText({
  system,
  content,
  state,
  rebuildSets
}: Pick<MobileDesignSystemPanelProps, 'system' | 'content' | 'state' | 'rebuildSets'>): string {
  const groups = designSystemDraftGroups(
    { tokens: content.tokens, components: content.components },
    state.draft
  )
  return buildDesignSystemUpdateMessage({
    currentVersion: system.version,
    groups,
    rebuild: state.rebuild ? designSystemRebuildSetsOf(rebuildSets) : [],
    freeText: state.freeText,
    ...(system.folderPath !== undefined ? { systemFolder: system.folderPath } : {})
  }).sentText
}

export type MobileDesignSystemSendFlow = {
  client: RpcClient | null
  /** The chat that takes the message; none, nothing is sent. */
  target: DesignSystemChat | undefined
  getState: () => DesignSystemViewState | undefined
  update: (transform: (state: DesignSystemViewState) => DesignSystemViewState) => void
}

/**
 * Sends one message to the target chat. A chat that takes it clears the draft; a refusal, or a send that throws,
 * keeps the draft and shows the failure line. Only the draft carries its images. True only when the chat took it.
 */
export async function sendMobileDesignSystemText(
  flow: MobileDesignSystemSendFlow,
  kind: DesignSystemSendKind,
  text: string
): Promise<boolean> {
  const { client, target, getState, update } = flow
  const current = getState()
  if (target === undefined || current?.sending === true) {
    return false
  }
  const attachments = kind === 'draft' && current ? draftAttachmentsOf(current) : []
  update(sendBegun)
  // Why: the chat on screen sends text only, so a message that carries images goes through the host.
  const send =
    attachments.length === 0
      ? sendMobilePrototypeText(client, target, text)
      : client === null
        ? Promise.resolve(false)
        : sendToStructuredSessionOnHost(client, target.sessionId, text, attachments)
  const accepted = await send.catch(() => false)
  update((latest) => (accepted ? sendAccepted(latest, kind) : sendRefused(latest, kind)))
  return accepted
}
