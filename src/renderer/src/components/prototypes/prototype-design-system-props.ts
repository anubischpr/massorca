import type { DesignSystemContent } from '../../../../shared/prototype-design-system-content'
import type {
  DesignSystemSendKind,
  DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import type { DesignSystemChat } from '../../../../shared/prototype-design-system-view'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'

export type { DesignSystemContent }

export type DesignSystemUpdate = (
  transform: (state: DesignSystemViewState) => DesignSystemViewState
) => void

/** The draft's image attach: the chat composer's picker, and what it last could not attach. */
export type DesignSystemImageControls = {
  pick: () => void
  disabled: boolean
  notice: string | null
  remove: (id: string) => void
}

/** What the Design system panels share: the system, its files, the view's state and the sends. */
export type DesignSystemPanelProps = {
  system: PrototypeListedDesignSystem
  content: DesignSystemContent
  state: DesignSystemViewState
  update: DesignSystemUpdate
  /** The chat that takes every message: the newest set's, else the pending request's. None disables every send. */
  target: DesignSystemChat | undefined
  /** The project's sets built on the current version: the ones a rebuild offers. */
  rebuildSets: readonly PrototypeListedSet[]
  /** Sends one message as the given kind, to the target chat unless another chat is given; a refusal keeps the draft. */
  runSend: (kind: DesignSystemSendKind, text: string, chat?: DesignSystemChat) => Promise<void>
  images: DesignSystemImageControls
}
