import { useEffect, useMemo, useRef, useState } from 'react'
import { sendMessageToAgent } from '@/lib/agent-message-send'
import { useAppStore } from '@/store'
import type { NativeChatVisualRect } from '../../../../shared/native-chat-visual-annotate'
import type { DesignSystemChat } from '../../../../shared/prototype-design-system-view'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { writePrototypeAttachmentOnHost } from '../../runtime/runtime-prototype-client'
import { prototypePanelsShown } from './prototype-panel-visibility'
import { usePrototypeViewStore } from './prototype-view-store'
import { activePrototypeSets } from '../../../../shared/prototype-archived-sets'
import { PrototypeDesignSystemScreen } from './PrototypeDesignSystemScreen'
import { PrototypeSidePanel } from './PrototypeSidePanel'
import { PrototypeViewer, type PrototypeVersionRestoreControls } from './PrototypeViewer'
import {
  buildMergeMessage,
  buildMergeSuggestionMessage
} from '../../../../shared/prototype-merge-message'
import { nextFreeDirectionLetter } from '../../../../shared/prototype-merge-plan'
import {
  beginMerge,
  beginMergeSend,
  canMerge,
  chatTookMerge,
  mergeRefused,
  mergeRequestRefused,
  mergeSent,
  planArrived,
  setMergeBaseline
} from '../../../../shared/prototype-merge-state'
import { PROTOTYPE_FRAMES } from '../../../../shared/prototype-frames'
import { sendPrototypeIteration } from '../../../../shared/prototype-send'
import type { PrototypeSetState } from '../../../../shared/prototype-set-state'
import { beginSend, sendRefused, sendSucceeded } from '../../../../shared/prototype-set-view'
import { prototypeTargetForSession, worktreeIdOfChatSession } from './prototype-host-targets'
import { prototypeHostKey } from './prototype-set-actions'
import { readPrototypeMergePlanText, usePrototypeMergePlan } from './use-prototype-merge-plan'
import { usePrototypeSets } from './use-prototype-sets'

async function captureFrameRect(
  rect: NativeChatVisualRect
): Promise<{ ok: true; pngBase64: string } | { ok: false }> {
  const result = await window.api.prototypeCapture.captureRect(rect)
  return result.ok ? { ok: true, pngBase64: result.pngBase64 } : { ok: false }
}

async function writeScreenshot(
  set: PrototypeListedSet,
  name: string,
  pngBase64: string
): Promise<{ ok: true; path: string } | { ok: false }> {
  try {
    const written = await writePrototypeAttachmentOnHost(prototypeTargetForSession(set.sessionId), {
      sessionId: set.sessionId,
      requestId: set.requestId,
      name,
      pngBase64
    })
    return written.ok ? { ok: true, path: written.path } : { ok: false }
  } catch {
    // An outdated host has no upload; the message still goes without this screenshot.
    return { ok: false }
  }
}

async function sendToChat(
  chat: Pick<DesignSystemChat, 'sessionId' | 'worktreeId'>,
  text: string
): Promise<boolean> {
  const worktreeId =
    chat.worktreeId ??
    worktreeIdOfChatSession(useAppStore.getState().unifiedTabsByWorktree, chat.sessionId)
  const result = await sendMessageToAgent({
    worktreeId: worktreeId ?? '',
    target: { kind: 'structured-session', sessionId: chat.sessionId },
    prompt: text
  })
  return result.status === 'sent'
}

/**
 * The Prototypes view: the selected set's viewer and draft, or a design system. The sets themselves are the
 * tree under Prototypes in the left sidebar.
 */
export default function PrototypesPage(): React.JSX.Element {
  const listed = usePrototypeSets()
  const selectedId = usePrototypeViewStore((s) => s.selectedRequestId)
  const selectedProjectKey = usePrototypeViewStore((s) => s.selectedProjectKey)
  const selectRequest = usePrototypeViewStore((s) => s.selectRequest)
  const selectDesignSystem = usePrototypeViewStore((s) => s.selectDesignSystem)
  const states = usePrototypeViewStore((s) => s.states)
  const ensureSetState = usePrototypeViewStore((s) => s.ensureSetState)
  const updateSetState = usePrototypeViewStore((s) => s.updateSetState)
  const sidePanelHidden = usePrototypeViewStore((s) => s.sidePanelHidden)
  const listPanelHidden = usePrototypeViewStore((s) => s.listPanelHidden)
  const setListPanelHidden = usePrototypeViewStore((s) => s.setListPanelHidden)
  const setFocusedSetSessions = usePrototypeViewStore((s) => s.setFocusedSetSessions)
  const mergeUnderWay = selectedId !== null && (states[selectedId]?.merge ?? null) !== null
  const frameBoxRef = useRef<HTMLDivElement | null>(null)

  // Why split: an archived set leaves the main list and its counts, and opens from the Archived group.
  const activeSets = useMemo(() => activePrototypeSets(listed.sets), [listed.sets])
  // Hosts that answered a restore with method_not_found: their sets keep Preview and lose Restore.
  const [restoreOutdatedHosts, setRestoreOutdatedHosts] = useState<ReadonlySet<string>>(
    () => new Set()
  )

  const system =
    selectedProjectKey === null
      ? undefined
      : listed.designSystems.find((entry) => entry.projectKey === selectedProjectKey)
  const selected = listed.sets.find((set) => set.requestId === selectedId) ?? null
  const selectedRequestId = selected?.requestId
  const selectedLetters = selected?.directions.map((direction) => direction.letter) ?? []
  const selectedLettersKey = selectedLetters.join('|')
  const firstRequestId = activeSets[0]?.requestId
  const { reload } = listed

  useEffect(() => {
    if (
      selectedRequestId === undefined &&
      firstRequestId !== undefined &&
      selectedProjectKey === null
    ) {
      selectRequest(firstRequestId)
    }
  }, [selectedRequestId, firstRequestId, selectedProjectKey, selectRequest])

  const focusedSessionId = selected?.sessionId
  const focusedOriginSessionId = selected?.origin?.sessionId
  useEffect(() => {
    setFocusedSetSessions(
      focusedSessionId === undefined
        ? null
        : { sessionId: focusedSessionId, originSessionId: focusedOriginSessionId ?? null }
    )
  }, [focusedSessionId, focusedOriginSessionId, setFocusedSetSessions])
  // Why: off this page nothing is in focus, so the floating checklist goes back to the chat.
  useEffect(() => () => setFocusedSetSessions(null), [setFocusedSetSessions])

  useEffect(() => {
    if (selectedRequestId !== undefined) {
      ensureSetState(selectedRequestId, selectedLettersKey.split('|').filter(Boolean))
    }
  }, [selectedRequestId, selectedLettersKey, ensureSetState])

  // Why: the list comes back once a merge is skipped or finished, so its hide is per merge, not a preference.
  useEffect(() => {
    if (!mergeUnderWay) {
      setListPanelHidden(false)
    }
  }, [mergeUnderWay, setListPanelHidden])

  usePrototypeMergePlan(
    selected,
    selectedRequestId === undefined ? null : (states[selectedRequestId]?.merge ?? null),
    (plan, text) => {
      if (selectedRequestId !== undefined) {
        updateSetState(selectedRequestId, (current) => planArrived(current, plan, text))
      }
    }
  )

  const versionRestore: PrototypeVersionRestoreControls = {
    supports: (set) =>
      !restoreOutdatedHosts.has(prototypeHostKey(prototypeTargetForSession(set.sessionId))),
    onOutdated: (set) =>
      setRestoreOutdatedHosts((previous) =>
        new Set(previous).add(prototypeHostKey(prototypeTargetForSession(set.sessionId)))
      ),
    onRestored: reload
  }

  if (system !== undefined) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 bg-chat-canvas">
        <PrototypeDesignSystemScreen system={system} sets={activeSets} sendText={sendToChat} />
      </div>
    )
  }

  const setState: PrototypeSetState | undefined =
    selectedRequestId === undefined ? undefined : states[selectedRequestId]

  if (selected === null || setState === undefined) {
    return <div className="flex min-h-0 min-w-0 flex-1 bg-chat-canvas" />
  }

  const update = (transform: (state: PrototypeSetState) => PrototypeSetState): void =>
    updateSetState(selected.requestId, transform)

  const nextLetter = nextFreeDirectionLetter(selectedLetters)

  const startMerge = async (): Promise<void> => {
    const { folderPath } = selected
    if (folderPath === undefined || !canMerge(setState, nextLetter)) {
      return
    }
    const planId = `m${Date.now().toString(36)}`
    update((current) => beginMerge(current, { planId }))
    // The plan file as it is now: an answer without an id must differ from it. The request goes out after that read.
    const baseline = await readPrototypeMergePlanText(selected)
    const latest = usePrototypeViewStore.getState().states[selected.requestId]
    const merge = latest?.merge
    if (latest === undefined || merge?.phase !== 'waiting' || merge.planId !== planId) {
      // Why: the user cancelled or left while the file was read, so nothing is asked.
      return
    }
    update((current) => setMergeBaseline(current, planId, baseline))
    const message = buildMergeSuggestionMessage({
      requestId: selected.requestId,
      letters: latest.starred,
      planId,
      folderPath
    })
    if (!(await chatTookMerge(() => sendToChat(selected, message.sentText)))) {
      update(mergeRequestRefused)
    }
  }

  const sendMerge = async (): Promise<void> => {
    const { folderPath } = selected
    const merge = usePrototypeViewStore.getState().states[selected.requestId]?.merge
    if (folderPath === undefined || nextLetter === null || merge?.phase !== 'review') {
      return
    }
    update(beginMergeSend)
    const message = buildMergeMessage({
      requestId: selected.requestId,
      letters: merge.letters,
      letter: nextLetter,
      parts: merge.parts,
      note: merge.note,
      folderPath
    })
    const sent = await chatTookMerge(() => sendToChat(selected, message.sentText))
    update((latest) =>
      sent
        ? mergeSent(latest, { letter: nextLetter, visibleMessage: message.visibleText })
        : mergeRefused(latest)
    )
  }

  const send = async (): Promise<void> => {
    const current = usePrototypeViewStore.getState().states[selected.requestId]
    if (current === undefined || current.sending) {
      return
    }
    update(beginSend)
    const frame = frameBoxRef.current?.getBoundingClientRect()
    const outcome = await sendPrototypeIteration(
      {
        state: current,
        set: selected,
        frameOrigin:
          frame === undefined
            ? null
            : { x: frame.left, y: frame.top, width: frame.width, height: frame.height },
        scale: frame === undefined ? 1 : frame.width / PROTOTYPE_FRAMES[current.viewport].width
      },
      {
        captureRect: captureFrameRect,
        writeAttachment: (name, pngBase64) => writeScreenshot(selected, name, pngBase64),
        sendMessage: (text) => sendToChat(selected, text),
        now: Date.now
      }
    )
    update((latest) =>
      outcome.sent ? sendSucceeded(latest, outcome.visibleMessage) : sendRefused(latest)
    )
  }

  const panels = prototypePanelsShown({ sidePanelHidden, listPanelHidden, mergeUnderWay })
  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-chat-canvas">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PrototypeViewer
          set={selected}
          state={setState}
          update={update}
          frameBoxRef={frameBoxRef}
          onOpenDesignSystem={selectDesignSystem}
          nextLetter={nextLetter}
          onMerge={() => void startMerge()}
          onSendMerge={() => void sendMerge()}
          versions={versionRestore}
        />
      </section>
      {panels.draft ? (
        <aside className="scrollbar-sleek flex min-h-0 w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border">
          <PrototypeSidePanel set={selected} state={setState} update={update} onSend={send} />
        </aside>
      ) : null}
    </div>
  )
}
