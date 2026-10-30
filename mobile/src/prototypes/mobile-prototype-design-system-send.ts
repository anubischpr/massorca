// The send of the design system draft on mobile: one "Update the design system" message to the project's chat.
import {
  designSystemDraftCount,
  designSystemDraftGroups
} from '../../../src/shared/prototype-design-system-draft'
import { buildDesignSystemUpdateMessage } from '../../../src/shared/prototype-design-system-message'
import { designSystemRebuildSetsOf } from '../../../src/shared/prototype-design-system-rebuild'
import type { DesignSystemChat } from '../../../src/shared/prototype-design-system-view'
import {
  sendAccepted,
  sendBegun,
  sendRefused,
  type DesignSystemSendKind,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import type { RpcClient } from '../transport/rpc-client'
import { sendMobilePrototypeText } from './mobile-prototype-chat-text-send'
import type { MobileDesignSystemPanelProps } from './mobile-prototype-design-system-props'

type DraftBase = Pick<MobileDesignSystemPanelProps, 'content' | 'state'>

/** How many changes the draft holds: the count the bar shows. */
export function mobileDesignSystemDraftCount({ content, state }: DraftBase): number {
  return designSystemDraftCount(
    { tokens: content.tokens, components: content.components },
    state.draft
  )
}

/** Whether Send would carry nothing: no change and no text. */
export function mobileDesignSystemNothingToSend(panel: DraftBase): boolean {
  return mobileDesignSystemDraftCount(panel) === 0 && panel.state.freeText.trim() === ''
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
 * keeps the draft and shows the failure line. True only when the chat took it.
 */
export async function sendMobileDesignSystemText(
  flow: MobileDesignSystemSendFlow,
  kind: DesignSystemSendKind,
  text: string
): Promise<boolean> {
  const { client, target, getState, update } = flow
  if (target === undefined || getState()?.sending === true) {
    return false
  }
  update(sendBegun)
  const accepted = await sendMobilePrototypeText(client, target, text).catch(() => false)
  update((latest) => (accepted ? sendAccepted(latest, kind) : sendRefused(latest, kind)))
  return accepted
}
