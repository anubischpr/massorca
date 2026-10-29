import { useEffect, useMemo, useRef, useState } from 'react'
import { sendMessageToAgent } from '@/lib/agent-message-send'
import type { NativeChatVisualRect } from '../../../../shared/native-chat-visual-annotate'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { writePrototypeAttachmentOnHost } from '../../runtime/runtime-prototype-client'
import { usePrototypeViewStore } from './prototype-view-store'
import { buildPrototypeListRows } from './prototype-list-model'
import { PrototypeListPanel } from './PrototypeListPanel'
import { PrototypeSidePanel } from './PrototypeSidePanel'
import { PrototypeViewer } from './PrototypeViewer'
import { sendPrototypeIteration } from './prototype-send'
import type { PrototypeSetState } from './prototype-set-state'
import { beginSend, sendRefused, sendSucceeded } from './prototype-set-view'
import { usePrototypeSets } from './use-prototype-sets'

const LOCAL_RUNTIME = { kind: 'local' } as const

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
    const written = await writePrototypeAttachmentOnHost(LOCAL_RUNTIME, {
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

async function sendToChat(set: PrototypeListedSet, text: string): Promise<boolean> {
  const result = await sendMessageToAgent({
    worktreeId: set.worktreeId ?? '',
    target: { kind: 'structured-session', sessionId: set.sessionId },
    prompt: text
  })
  return result.status === 'sent'
}

/** The Prototypes view: the list of sets, the selected set's viewer, and its edit panel and draft. */
export default function PrototypesPage(): React.JSX.Element {
  const listed = usePrototypeSets()
  const filter = usePrototypeViewStore((s) => s.filter)
  const setFilter = usePrototypeViewStore((s) => s.setFilter)
  const selectedId = usePrototypeViewStore((s) => s.selectedRequestId)
  const selectRequest = usePrototypeViewStore((s) => s.selectRequest)
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

  const selected = listed.sets.find((set) => set.requestId === selectedId) ?? null
  const selectedRequestId = selected?.requestId
  const selectedLetters = selected?.directions.map((direction) => direction.letter) ?? []
  const selectedLettersKey = selectedLetters.join('|')
  const firstRequestId = listed.sets[0]?.requestId

  useEffect(() => {
    if (selectedRequestId === undefined && firstRequestId !== undefined) {
      selectRequest(firstRequestId)
    }
  }, [selectedRequestId, firstRequestId, selectRequest])

  useEffect(() => {
    if (selectedRequestId !== undefined) {
      ensureSetState(selectedRequestId, selectedLettersKey.split('|').filter(Boolean))
    }
  }, [selectedRequestId, selectedLettersKey, ensureSetState])

  const setState: PrototypeSetState | undefined =
    selectedRequestId === undefined ? undefined : states[selectedRequestId]

  if (selected === null || setState === undefined) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1">
        <PrototypeListPanel
          rows={rows}
          filter={filter}
          onFilter={setFilter}
          selectedRequestId={null}
          onSelect={selectRequest}
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
        rows={rows}
        filter={filter}
        onFilter={setFilter}
        selectedRequestId={selected.requestId}
        onSelect={selectRequest}
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border">
        <PrototypeViewer
          set={selected}
          state={setState}
          update={update}
          frameBoxRef={frameBoxRef}
        />
      </section>
      <aside className="scrollbar-sleek flex min-h-0 w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border">
        <PrototypeSidePanel set={selected} state={setState} update={update} onSend={send} />
      </aside>
    </div>
  )
}
