import type { DesignSystemContent } from '../../../src/shared/prototype-design-system-content'
import type { DesignSystemChat } from '../../../src/shared/prototype-design-system-view'
import type {
  DesignSystemSendKind,
  DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import type { MobileDesignSystemImageControls } from './mobile-prototype-design-system-images'

export type MobileDesignSystemUpdate = (
  transform: (state: DesignSystemViewState) => DesignSystemViewState
) => void

/** What the design system screen's tabs and sheets share: the system, its files, the view's state and the send. */
export type MobileDesignSystemPanelProps = {
  system: PrototypeListedDesignSystem
  content: DesignSystemContent
  state: DesignSystemViewState
  update: MobileDesignSystemUpdate
  /** The chat that takes every message: the newest set's, else the pending request's. None disables Send. */
  target: DesignSystemChat | undefined
  /** The project's sets built on the current version: the ones a rebuild offers. */
  rebuildSets: readonly PrototypeListedSet[]
  /** Attaches images to the draft, from "Anything else" or a note. */
  images: MobileDesignSystemImageControls
  /** Sends one message to the target chat; a refusal keeps the draft. */
  runSend: (kind: DesignSystemSendKind, text: string) => Promise<void>
}
