import { useEffect, useMemo, useRef, useState } from 'react'
import { sendMessageToAgent } from '@/lib/agent-message-send'
import { useAppStore } from '@/store'
import type { NativeChatVisualRect } from '../../../../shared/native-chat-visual-annotate'
import type { DesignSystemChat } from '../../../../shared/prototype-design-system-view'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { writePrototypeAttachmentOnHost } from '../../runtime/runtime-prototype-client'
import { usePrototypeViewStore } from './prototype-view-store'
import { buildPrototypeListRows } from '../../../../shared/prototype-list-model'
import { buildPrototypeListGroups } from '../../../../shared/prototype-list-groups'
import { PrototypeDesignSystemScreen } from './PrototypeDesignSystemScreen'
import { PrototypeListPanel } from './PrototypeListPanel'
import { PrototypeSidePanel } from './PrototypeSidePanel'
import { PrototypeViewer } from './PrototypeViewer'
import { sendPrototypeIteration } from '../../../../shared/prototype-send'
import type { PrototypeSetState } from '../../../../shared/prototype-set-state'
import { beginSend, sendRefused, sendSucceeded } from '../../../../shared/prototype-set-view'
import { prototypeTargetForSession, worktreeIdOfChatSession } from './prototype-host-targets'
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
  const frameBoxRef = useRef<HTMLDivElement | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const rows = useMemo(
    () =>
      buildPrototypeListRows({
        sets: listed.sets,
        filter,
        activeLetterOf: (requestId) => states[requestId]?.active,
        nowMs
      }),
    [listed.sets, filter, states, nowMs]
  )
  const groups = useMemo(
    () =>
      buildPrototypeListGroups({
        sets: listed.sets,
        rows,
        designSystems: listed.designSystems
      }),
    [listed.sets, listed.designSystems, rows]
  )

  const system =
    selectedProjectKey === null
      ? undefined
      : listed.designSystems.find((entry) => entry.projectKey === selectedProjectKey)
  const selected = listed.sets.find((set) => set.requestId === selectedId) ?? null
  const selectedRequestId = selected?.requestId
  const selectedLetters = selected?.directions.map((direction) => direction.letter) ?? []
  const selectedLettersKey = selectedLetters.join('|')
  const firstRequestId = listed.sets[0]?.requestId

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

  if (system !== undefined) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1">
        <PrototypeListPanel
          groups={groups}
          filter={filter}
          onFilter={setFilter}
          selectedRequestId={null}
          selectedProjectKey={system.projectKey}
          onSelect={selectRequest}
          onSelectSystem={selectDesignSystem}
        />
        <PrototypeDesignSystemScreen system={system} sets={listed.sets} sendText={sendToChat} />
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
        />
      </div>
    )
  }

  const update = (transform: (state: PrototypeSetState) => PrototypeSetState): void =>
    updateSetState(selected.requestId, transform)

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
            : { x: frame.left, y: frame.top, width: frame.width, height: frame.height }
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <PrototypeListPanel
        groups={groups}
        filter={filter}
        onFilter={setFilter}
        selectedRequestId={selected.requestId}
        selectedProjectKey={null}
        onSelect={selectRequest}
        onSelectSystem={selectDesignSystem}
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border">
        <PrototypeViewer
          set={selected}
          state={setState}
          update={update}
          frameBoxRef={frameBoxRef}
          onOpenDesignSystem={selectDesignSystem}
        />
      </section>
      <aside className="scrollbar-sleek flex min-h-0 w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border">
        <PrototypeSidePanel set={selected} state={setState} update={update} onSend={send} />
      </aside>
    </div>
  )
}
