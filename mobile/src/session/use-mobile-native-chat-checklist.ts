import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  nativeChatChecklist,
  type NativeChatChecklist,
  type NativeChatChecklistItem,
  type NativeChatChecklistPersonState,
  type NativeChatChecklistScreenshot
} from '../../../src/shared/native-chat-checklist'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { useMediaPicker } from '../platform/media-picker'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import {
  mobileNativeChatChecklistScreenshotName,
  nativeChatChecklistRepliesOf,
  nativeChatChecklistWrittenAt
} from './mobile-native-chat-checklist-model'
import {
  agentSessionChecklistRead,
  agentSessionChecklistSetItem
} from './mobile-native-chat-checklist-rpc'
import { uploadMobileNativeChatImages } from './mobile-native-chat-image-attachment'
import { rpcClientKey } from './mobile-rpc-client-key'
import type { MobileNativeChatVisualSource } from './mobile-native-chat-visual-read'
import { readMobileWorktreeConnectionId } from './mobile-worktree-connection-id'

/** How often an open sheet re-reads the person's marks, so a change made on desktop shows up. */
const CHECKLIST_POLL_MS = 4_000

/** The person's change to one item; a field left out was not changed. */
export type MobileChecklistItemChange = {
  checked?: boolean
  note?: string
  screenshots?: NativeChatChecklistScreenshot[]
}

/** A change to the list itself: the person adds an item, or takes back one they added. */
type MobileChecklistPersistChange = MobileChecklistItemChange & { add?: true; remove?: true }

/** A checklist item; `addedAt` is when the person added it, null for the agent's items. */
export type MobileNativeChatChecklistItem = NativeChatChecklistItem & { addedAt?: number | null }

export type MobileNativeChatChecklist = Omit<NativeChatChecklist, 'items'> & {
  items: MobileNativeChatChecklistItem[]
}

/** A screenshot picked on this phone: the host path to send, its name, and a local preview. */
export type MobileChecklistScreenshotDraft = {
  path: string
  name: string
  previewUri: string
}

export type MobileNativeChatChecklistArgs = {
  /** The structured session that owns the chat: its host client and session id. */
  source: MobileNativeChatVisualSource | null
  messages: readonly NativeChatMessage[]
  /** The chat's worktree, to find the connection its files go to; null for a floating workspace. */
  worktreeId: string | null
}

export type MobileNativeChatChecklistView = {
  /** The chat's checklist with the person's marks applied; null until the agent writes one or the person adds an item. */
  checklist: MobileNativeChatChecklist | null
  /** When the agent last wrote the checklist, for the sheet's source line. */
  writtenAt: number | null
  /** The host cannot take the person's marks, so the sheets show the checklist read-only. */
  readOnly: boolean
  listOpen: boolean
  /** The item whose sheet is open, or null. */
  activeKey: string | null
  /** Counts item-sheet opens, so each open starts from the stored item. */
  itemOpenCount: number
  openList: () => void
  closeList: () => void
  openItem: (key: string) => void
  closeItem: () => void
  toggleItem: (item: NativeChatChecklistItem) => Promise<boolean>
  /** Saves one item; closes its sheet when that sheet is the one open. */
  saveItem: (key: string, change: MobileChecklistItemChange) => Promise<boolean>
  /** Adds an item the person wrote; resolves true once the host has stored it. */
  addItem: (text: string) => Promise<boolean>
  /** Takes back an item the person added; closes its sheet when that sheet is the one open. */
  removeItem: (key: string) => Promise<boolean>
  /** Picks one image from the photo library and uploads it; empty when nothing was added. */
  pickScreenshot: () => Promise<MobileChecklistScreenshotDraft[]>
}

/**
 * The chat's checklist and the person's marks on it. Reads the marks when the chat's messages change
 * and while a checklist sheet is open, and applies each state the host answers with.
 */
export function useMobileNativeChatChecklist({
  source,
  messages,
  worktreeId
}: MobileNativeChatChecklistArgs): MobileNativeChatChecklistView {
  const picker = useMediaPicker()
  const scopeKey =
    source === null ? null : JSON.stringify([rpcClientKey(source.client), source.sessionId])
  const [loaded, setLoaded] = useState<{
    scope: string
    state: NativeChatChecklistPersonState
  } | null>(null)
  const [unsupportedScope, setUnsupportedScope] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [itemOpenCount, setItemOpenCount] = useState(0)

  const replies = useMemo(() => nativeChatChecklistRepliesOf(messages), [messages])
  const person = loaded !== null && loaded.scope === scopeKey ? loaded.state : null
  const shared = useMemo(() => nativeChatChecklist(replies, person), [replies, person])
  const checklist = useMemo((): MobileNativeChatChecklist | null => {
    if (shared === null) {
      return null
    }
    return {
      ...shared,
      items: shared.items.map((item) => ({
        ...item,
        addedAt: person?.marks[item.key]?.addedAt ?? null
      }))
    }
  }, [shared, person])
  const writtenAt = useMemo(() => nativeChatChecklistWrittenAt(replies), [replies])
  const readOnly = scopeKey !== null && unsupportedScope === scopeKey

  // The callbacks below outlive the render that made them, so they read the latest values here.
  const sourceRef = useRef(source)
  const worktreeRef = useRef(worktreeId)
  const checklistRef = useRef(checklist)
  useLayoutEffect(() => {
    sourceRef.current = source
    worktreeRef.current = worktreeId
    checklistRef.current = checklist
  }, [source, worktreeId, checklist])

  // A host's older state never overwrites a newer one that already arrived (by revision).
  const applyState = useCallback((scope: string, state: NativeChatChecklistPersonState) => {
    setLoaded((current) =>
      current !== null && current.scope === scope && current.state.revision > state.revision
        ? current
        : { scope, state }
    )
  }, [])

  const readState = useCallback(async (): Promise<void> => {
    const current = sourceRef.current
    if (current === null) {
      return
    }
    const scope = JSON.stringify([rpcClientKey(current.client), current.sessionId])
    let response
    try {
      response = await agentSessionChecklistRead.request(current.client, {
        sessionId: current.sessionId
      })
    } catch {
      return
    }
    if (!response.ok && isMobileMethodUnavailableError(response.error.code, response.error.message)) {
      setUnsupportedScope(scope)
      return
    }
    const reply = agentSessionChecklistRead.interpret(response)
    if (reply !== null && reply.ok) {
      applyState(scope, reply.state)
    }
  }, [applyState])

  // Read on open, and whenever the chat's messages change (a reply or the person's send moves the marks).
  // Every chat reads, since the person can add items before the agent writes any; a host that refuses
  // the methods stays read-only and is not asked again.
  const readTrigger = `${messages.length}:${messages[messages.length - 1]?.id ?? ''}`
  useEffect(() => {
    if (readOnly) {
      return
    }
    void readState()
  }, [readState, scopeKey, readTrigger, readOnly, listOpen, activeKey])

  const polling = (listOpen || activeKey !== null) && !readOnly
  useEffect(() => {
    if (!polling) {
      return
    }
    const timer = setInterval(() => {
      void readState()
    }, CHECKLIST_POLL_MS)
    return () => clearInterval(timer)
  }, [polling, readState])

  const persist = useCallback(
    async (text: string, change: MobileChecklistPersistChange): Promise<boolean> => {
      const current = sourceRef.current
      if (current === null) {
        return false
      }
      const scope = JSON.stringify([rpcClientKey(current.client), current.sessionId])
      let response
      try {
        response = await agentSessionChecklistSetItem.request(current.client, {
          sessionId: current.sessionId,
          title: checklistRef.current?.title ?? null,
          text,
          ...change
        })
      } catch {
        return false
      }
      if (
        !response.ok &&
        isMobileMethodUnavailableError(response.error.code, response.error.message)
      ) {
        setUnsupportedScope(scope)
        return false
      }
      const reply = agentSessionChecklistSetItem.interpret(response)
      if (reply === null || !reply.ok) {
        return false
      }
      applyState(scope, reply.state)
      return true
    },
    [applyState]
  )

  const toggleItem = useCallback(
    (item: NativeChatChecklistItem) => persist(item.text, { checked: !item.checked }),
    [persist]
  )

  const addItem = useCallback((text: string) => persist(text, { add: true }), [persist])

  const removeItem = useCallback(
    async (key: string): Promise<boolean> => {
      const item = checklistRef.current?.items.find((candidate) => candidate.key === key)
      if (item === undefined) {
        return false
      }
      const removed = await persist(item.text, { remove: true })
      if (removed) {
        setActiveKey((open) => (open === key ? null : open))
      }
      return removed
    },
    [persist]
  )

  const saveItem = useCallback(
    async (key: string, change: MobileChecklistItemChange): Promise<boolean> => {
      const item = checklistRef.current?.items.find((candidate) => candidate.key === key)
      if (item === undefined) {
        return false
      }
      const saved = await persist(item.text, change)
      if (saved) {
        setActiveKey((open) => (open === key ? null : open))
      }
      return saved
    },
    [persist]
  )

  const pickScreenshot = useCallback(async (): Promise<MobileChecklistScreenshotDraft[]> => {
    const current = sourceRef.current
    if (current === null) {
      return []
    }
    const worktree = worktreeRef.current
    try {
      // The composer's own upload: the same picker and host path, so a screenshot lands where a chat image does.
      const uploaded = await uploadMobileNativeChatImages('library', {
        client: current.client,
        getConnectionId: () =>
          worktree === null
            ? Promise.resolve(null)
            : readMobileWorktreeConnectionId(current.client, worktree),
        pickImages: async (pickSource) => {
          const image = await picker.pickImage(pickSource)
          return image === null ? [] : [image]
        }
      })
      return uploaded.map((image) => ({
        path: image.path,
        name: mobileNativeChatChecklistScreenshotName(image.path),
        previewUri: image.previewUri
      }))
    } catch {
      // A refused photo permission, an oversized image or a dropped upload adds nothing.
      return []
    }
  }, [picker])

  const openList = useCallback(() => setListOpen(true), [])
  const closeList = useCallback(() => setListOpen(false), [])
  const openItem = useCallback((key: string) => {
    setActiveKey(key)
    setItemOpenCount((count) => count + 1)
  }, [])
  const closeItem = useCallback(() => setActiveKey(null), [])

  return useMemo(
    () => ({
      checklist,
      writtenAt,
      readOnly,
      listOpen,
      activeKey,
      itemOpenCount,
      openList,
      closeList,
      openItem,
      closeItem,
      toggleItem,
      saveItem,
      addItem,
      removeItem,
      pickScreenshot
    }),
    [
      checklist,
      writtenAt,
      readOnly,
      listOpen,
      activeKey,
      itemOpenCount,
      openList,
      closeList,
      openItem,
      closeItem,
      toggleItem,
      saveItem,
      addItem,
      removeItem,
      pickScreenshot
    ]
  )
}
