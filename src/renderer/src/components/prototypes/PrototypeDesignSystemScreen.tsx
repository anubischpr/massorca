import { useCallback } from 'react'
import {
  designSystemChatOf,
  setsBuiltOn,
  type DesignSystemChat
} from '../../../../shared/prototype-design-system-view'
import {
  emptyDesignSystemViewState,
  sendAccepted,
  sendBegun,
  sendRefused,
  type DesignSystemSendKind,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeDesignSystemAside } from './PrototypeDesignSystemAside'
import { PrototypeDesignSystemView } from './PrototypeDesignSystemView'
import type { DesignSystemPanelProps } from './prototype-design-system-props'
import { usePrototypeViewStore } from './prototype-view-store'
import { useDesignSystemContent } from './use-prototype-design-system-content'

// One shared empty state, so a project with no state yet hands the same object to every render.
const NO_VIEW_STATE = emptyDesignSystemViewState()

/**
 * The Design system screen of the selected project. Its view state is kept per project, so a tab, a
 * selection or a draft survives moving to a set and back.
 */
export function PrototypeDesignSystemScreen({
  system,
  sets,
  sendText
}: {
  system: PrototypeListedDesignSystem
  sets: readonly PrototypeListedSet[]
  /** Sends text to a chat; true only when the chat took it. */
  sendText: (chat: DesignSystemChat, text: string) => Promise<boolean>
}): React.JSX.Element {
  const { projectKey } = system
  const target = designSystemChatOf(sets, system)
  const rebuildSets = setsBuiltOn(sets, projectKey, system.version)
  const content = useDesignSystemContent(
    target?.sessionId,
    `${projectKey}:${system.version}:${system.tokenCount}:${system.status}`
  )
  const state = usePrototypeViewStore(
    (store) => store.designSystemViews[projectKey] ?? NO_VIEW_STATE
  )
  const updateView = usePrototypeViewStore((store) => store.updateDesignSystemView)
  const update = useCallback(
    (transform: (latest: DesignSystemViewState) => DesignSystemViewState): void => {
      updateView(projectKey, transform)
    },
    [updateView, projectKey]
  )
  const runSend = async (
    kind: DesignSystemSendKind,
    text: string,
    chat: DesignSystemChat | undefined = target
  ): Promise<void> => {
    const current = usePrototypeViewStore.getState().designSystemViews[projectKey]
    if (chat === undefined || current?.sending === true) {
      return
    }
    update(sendBegun)
    const accepted = await sendText(chat, text).catch(() => false)
    update((latest) => (accepted ? sendAccepted(latest, kind) : sendRefused(latest, kind)))
  }
  if (content.status !== 'ready') {
    return <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border" />
  }
  const panel: DesignSystemPanelProps = {
    system,
    content: content.content,
    state,
    update,
    target,
    rebuildSets,
    runSend
  }
  return (
    <>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border">
        <PrototypeDesignSystemView {...panel} />
      </section>
      <aside className="scrollbar-sleek flex min-h-0 w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border">
        <PrototypeDesignSystemAside {...panel} />
      </aside>
    </>
  )
}
