import { useEffect, useMemo, useRef, useState } from 'react'
import { sendMessageToAgent } from '@/lib/agent-message-send'
import { useAppStore } from '@/store'
import type { NativeChatVisualRect } from '../../../../shared/native-chat-visual-annotate'
import type { DesignSystemChat } from '../../../../shared/prototype-design-system-view'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { writePrototypeAttachmentOnHost } from '../../runtime/runtime-prototype-client'
import { prototypePanelsShown } from './prototype-panel-visibility'
import { usePrototypeViewStore } from './prototype-view-store'
import { buildPrototypeListRows } from '../../../../shared/prototype-list-model'
import {
  activePrototypeSets,
  archivedPrototypeSets,
  requestToOpenAfterArchiving
} from '../../../../shared/prototype-archived-sets'
import { buildPrototypeListGroups } from '../../../../shared/prototype-list-groups'
import { PrototypeDesignSystemScreen } from './PrototypeDesignSystemScreen'
import type { PrototypeArchiveControls } from './PrototypeArchivedGroup'
import { PrototypeListPanel } from './PrototypeListPanel'
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
import {
  prototypeHostKey,
  runPrototypeSetAction,
  type PrototypeSetAction
} from './prototype-set-actions'
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

/** The Prototypes view: the grouped list, then the selected set's viewer and draft, or a design system. */
export default function PrototypesPage(): React.JSX.Element {
  const listed = usePrototypeSets()
  const filter = usePrototypeViewStore((s) => s.filter)
  const setFilter = usePrototypeViewStore((s) => s.setFilter)
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
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const mergeUnderWay = selectedId !== null && (states[selectedId]?.merge ?? null) !== null
  const frameBoxRef = useRef<HTMLDivElement | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Why split: an archived set leaves the main list and its counts, and opens from the Archived group.
  const activeSets = useMemo(() => activePrototypeSets(listed.sets), [listed.sets])
  const rows = useMemo(
    () =>
      buildPrototypeListRows({
        sets: activeSets,
        filter,
        activeLetterOf: (requestId) => states[requestId]?.active,
        nowMs
      }),
    [activeSets, filter, states, nowMs]
  )
  const archivedRows = useMemo(
    () =>
      buildPrototypeListRows({
        sets: archivedPrototypeSets(listed.sets),
        filter,
        activeLetterOf: (requestId) => states[requestId]?.active,
        nowMs
      }),
    [listed.sets, filter, states, nowMs]
  )
  const groups = useMemo(
    () =>
      buildPrototypeListGroups({
        sets: activeSets,
        rows,
        designSystems: listed.designSystems
      }),
    [activeSets, listed.designSystems, rows]
  )
  // Hosts that answered an archive action with method_not_found: their sets are not offered the actions.
  const [outdatedHosts, setOutdatedHosts] = useState<ReadonlySet<string>>(() => new Set())
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

  const runSetAction = async (
    action: PrototypeSetAction,
    set: PrototypeListedSet
  ): Promise<void> => {
    const outcome = await runPrototypeSetAction(action, set)
    if (outcome === 'unsupported') {
      const hostKey = prototypeHostKey(prototypeTargetForSession(set.sessionId))
      setOutdatedHosts((previous) => new Set(previous).add(hostKey))
    }
    reload()
  }
  const archive: PrototypeArchiveControls = {
    rows: archivedRows,
    supports: (set) =>
      !outdatedHosts.has(prototypeHostKey(prototypeTargetForSession(set.sessionId))),
    onArchive: (set) => {
      if (set.requestId === selectedRequestId) {
        // Why: the open set leaves the main list, so the view moves to its neighbor instead of keeping a hidden one.
        selectRequest(
          requestToOpenAfterArchiving(
            groups.flatMap((group) => group.rows),
            set.requestId
          )
        )
      }
      void runSetAction('archive', set)
    },
    onUnarchive: (set) => void runSetAction('unarchive', set),
    onDelete: (set) => void runSetAction('delete', set)
  }
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
      <div className="flex min-h-0 min-w-0 flex-1">
        {sidebarOpen ? (
          <PrototypeListPanel
            groups={groups}
            filter={filter}
            onFilter={setFilter}
            selectedRequestId={null}
            selectedProjectKey={system.projectKey}
            onSelect={selectRequest}
            onSelectSystem={selectDesignSystem}
            archive={archive}
          />
        ) : null}
        <PrototypeDesignSystemScreen system={system} sets={activeSets} sendText={sendToChat} />
      </div>
    )
  }

  const setState: PrototypeSetState | undefined =
    selectedRequestId === undefined ? undefined : states[selectedRequestId]

  if (selected === null || setState === undefined) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1">
        <PrototypeListPanel
          groups={groups}
          filter={filter}
          onFilter={setFilter}
          selectedRequestId={null}
          selectedProjectKey={null}
          onSelect={selectRequest}
          onSelectSystem={selectDesignSystem}
          archive={archive}
        />
      </div>
    )
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

  const panels = prototypePanelsShown({
    sidePanelHidden,
    listPanelHidden,
    mergeUnderWay,
    sidebarOpen
  })
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {panels.list ? (
        <PrototypeListPanel
          groups={groups}
          filter={filter}
          onFilter={setFilter}
          selectedRequestId={selected.requestId}
          selectedProjectKey={null}
          onSelect={selectRequest}
          onSelectSystem={selectDesignSystem}
          archive={archive}
        />
      ) : null}
      <section
        className={
          panels.list
            ? 'flex min-h-0 min-w-0 flex-1 flex-col border-l border-border'
            : 'flex min-h-0 min-w-0 flex-1 flex-col'
        }
      >
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
