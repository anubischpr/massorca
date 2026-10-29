import type { ComponentSection } from '../../../../shared/prototype-design-system-components'
import type {
  DesignSystemSendKind,
  DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import type {
  DesignSystemMeta,
  DesignToken
} from '../../../../shared/prototype-design-system-tokens'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'

/** What a system's files hold once read: its tokens with their metadata, and its components with their style block. */
export type DesignSystemContent = {
  tokens: readonly DesignToken[]
  meta: DesignSystemMeta
  components: readonly ComponentSection[]
  styleBlock: string
}

export type DesignSystemUpdate = (
  transform: (state: DesignSystemViewState) => DesignSystemViewState
) => void

/** What the Design system panels share: the system, its files, the view's state and the sends. */
export type DesignSystemPanelProps = {
  system: PrototypeListedDesignSystem
  content: DesignSystemContent
  state: DesignSystemViewState
  update: DesignSystemUpdate
  /** The set whose chat takes every message: the project's newest set. None disables every send. */
  target: PrototypeListedSet | undefined
  /** The project's sets built on the current version: the ones a rebuild offers. */
  rebuildSets: readonly PrototypeListedSet[]
  /** Sends one message to the target chat as the given kind; a refusal keeps the draft. */
  runSend: (kind: DesignSystemSendKind, text: string) => Promise<void>
}
