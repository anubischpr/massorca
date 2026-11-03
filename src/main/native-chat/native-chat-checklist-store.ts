// The person's marks on each chat's checklist, kept on the host that owns the chat so every client
// (desktop, phone, a paired or SSH-connected one) reads and writes the same record.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  nativeChatChecklistItemKey,
  nativeChatChecklistUpdateText,
  type NativeChatChecklistMark,
  type NativeChatChecklistPersonState
} from '../../shared/native-chat-checklist'
import type { AgentSessionChecklistSetItemParams } from '../../shared/rpc-contract/agent-session-checklist-params'
import { nativeChatVisualsFolderName } from './native-chat-visuals-folder'

export const NATIVE_CHAT_CHECKLISTS_DIR_NAME = 'native-chat-checklists'
/** Sends remembered per chat, so a retried send carries the same update it first claimed. */
const MAX_REMEMBERED_DELIVERIES = 20

type Delivery = {
  operationId: string
  update: string | null
  /** What was delivered before this claim, restored when its send is refused. */
  previousDelivered: number
}
type ChecklistFile = { state: NativeChatChecklistPersonState; deliveries: Delivery[] }

function emptyFile(): ChecklistFile {
  return { state: { revision: 0, deliveredRevision: 0, title: null, marks: {} }, deliveries: [] }
}

function parseFile(raw: string): ChecklistFile {
  const value: unknown = JSON.parse(raw)
  if (
    value === null ||
    typeof value !== 'object' ||
    !('state' in value) ||
    !('deliveries' in value) ||
    !Array.isArray(value.deliveries)
  ) {
    return emptyFile()
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: written only by this store, shape checked above.
  return value as ChecklistFile
}

export class NativeChatChecklistStore {
  private readonly queues = new Map<string, Promise<unknown>>()

  constructor(
    private readonly stateDirectory: string,
    private readonly now: () => number = Date.now
  ) {}

  private pathFor(sessionId: string): string {
    return join(
      this.stateDirectory,
      NATIVE_CHAT_CHECKLISTS_DIR_NAME,
      `${nativeChatVisualsFolderName(sessionId)}.json`
    )
  }

  private async load(sessionId: string): Promise<ChecklistFile> {
    try {
      return parseFile(await readFile(this.pathFor(sessionId), 'utf8'))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return emptyFile()
      }
      throw error
    }
  }

  private async save(sessionId: string, file: ChecklistFile): Promise<void> {
    const path = this.pathFor(sessionId)
    await mkdir(join(this.stateDirectory, NATIVE_CHAT_CHECKLISTS_DIR_NAME), { recursive: true })
    const temporary = `${path}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(file), 'utf8')
    await rename(temporary, path)
  }

  /** One read-modify-write at a time per chat. */
  private serialize<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(sessionId) ?? Promise.resolve()
    const next = previous.then(task, task)
    this.queues.set(
      sessionId,
      next.catch(() => undefined)
    )
    return next
  }

  async read(sessionId: string): Promise<NativeChatChecklistPersonState> {
    return (await this.load(sessionId)).state
  }

  setItem(
    params: Omit<AgentSessionChecklistSetItemParams, 'sessionId'> & { sessionId: string }
  ): Promise<NativeChatChecklistPersonState> {
    return this.serialize(params.sessionId, async () => {
      const file = await this.load(params.sessionId)
      const { state } = file
      const key = nativeChatChecklistItemKey(params.text)
      const at = this.now()
      const revision = state.revision + 1
      const mark: NativeChatChecklistMark = { ...state.marks[key], text: params.text.trim(), revision }
      if (params.add) {
        mark.addedAt = mark.addedAt ?? at
        delete mark.removed
      }
      if (params.remove && mark.addedAt !== undefined) {
        mark.removed = true
      }
      if (params.checked !== undefined) {
        mark.checked = params.checked
        mark.checkedAt = at
      }
      if (params.note !== undefined) {
        const note = params.note.trim()
        if (note) {
          mark.note = note
        } else {
          delete mark.note
        }
        mark.noteAt = at
      }
      if (params.screenshots !== undefined) {
        if (params.screenshots.length > 0) {
          mark.screenshots = params.screenshots
        } else {
          delete mark.screenshots
        }
        mark.noteAt = at
      }
      state.marks[key] = mark
      state.revision = revision
      if (params.title !== undefined) {
        state.title = params.title
      }
      await this.save(params.sessionId, file)
      return state
    })
  }

  /**
   * The update a send carries: every mark the agent has not seen, then marked as seen. The same
   * operation id always gets the same answer, so a retried send stays byte-identical.
   */
  claimUpdate(sessionId: string, operationId: string): Promise<string | null> {
    return this.serialize(sessionId, async () => {
      const file = await this.load(sessionId)
      const known = file.deliveries.find((entry) => entry.operationId === operationId)
      if (known) {
        return known.update
      }
      const update = nativeChatChecklistUpdateText(file.state)
      if (!update && file.deliveries.length === 0 && file.state.revision === 0) {
        // No checklist marks in this chat: nothing to record.
        return null
      }
      const previousDelivered = file.state.deliveredRevision
      file.state.deliveredRevision = file.state.revision
      file.deliveries = [...file.deliveries, { operationId, update, previousDelivered }].slice(
        -MAX_REMEMBERED_DELIVERIES
      )
      await this.save(sessionId, file)
      return update
    })
  }

  /** A refused send never reached the agent: its claim is undone if nothing claimed after it. */
  releaseUpdate(sessionId: string, operationId: string): Promise<void> {
    return this.serialize(sessionId, async () => {
      const file = await this.load(sessionId)
      const last = file.deliveries.at(-1)
      if (last?.operationId !== operationId) {
        return
      }
      file.state.deliveredRevision = last.previousDelivered
      file.deliveries = file.deliveries.slice(0, -1)
      await this.save(sessionId, file)
    })
  }
}
