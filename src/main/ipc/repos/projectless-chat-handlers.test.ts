import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserWindow } from 'electron'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { closeTestStores, createStore, testState } from '../../persistence-test-harness'
import { registerProjectlessChatHandlers } from './projectless-chat-handlers'

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, args: unknown) => unknown>()
}))
vi.mock('electron', () => ({
  BrowserWindow: class {},
  app: { getPath: () => testState.dir },
  safeStorage: { isEncryptionAvailable: () => false },
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))
vi.mock('../../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../../telemetry/cohort-classifier', () => ({
  getCohortAtEmit: vi.fn()
}))
vi.mock('./repos-changed-notification', () => ({
  notifyReposChanged: vi.fn()
}))

const NOW = new Date(2026, 4, 9, 10, 30)

async function invoke(channel: string, args: unknown): Promise<unknown> {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`Handler not registered: ${channel}`)
  }
  return handler(undefined, args)
}

describe('projectless chat workspace IPC', () => {
  let root: string

  beforeEach(() => {
    handlers.clear()
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-projectless-ipc-'))
    root = join(testState.dir, 'chats')
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  function register(store: ReturnType<typeof createStore>): void {
    store.updateSettings({ projectlessChatsDir: root })
    registerProjectlessChatHandlers(new BrowserWindow(), store, {
      now: () => NOW
    })
  }

  it('creates a dated folder named by a short chat id, with a temporary name and a pending title', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const store = createStore()
    register(store)

    const expectedFolder = join(root, '2026-05-09', '000000')
    const result = await invoke('projectlessChats:createWorkspace', {
      createdWithAgent: 'claude',
      createChatNaming: { model: null }
    })

    expect(existsSync(expectedFolder)).toBe(true)
    const chatGroup = store.getProjectGroups().find((entry) => entry.name === 'Chats')
    expect(chatGroup).toMatchObject({ parentPath: root, connectionId: null })
    const groupId = chatGroup?.id
    const workspace = store
      .getFolderWorkspaces()
      .find((entry) => entry.folderPath === expectedFolder)
    expect(workspace).toMatchObject({
      projectGroupId: groupId,
      name: '000000',
      createdWithAgent: 'claude',
      pendingFirstAgentMessageRename: true,
      createChatNaming: { model: null }
    })
    expect(result).toMatchObject({
      ok: true,
      folderPath: expectedFolder,
      workspaceKey: `folder:${workspace?.id}`,
      workspace: { id: workspace?.id, projectGroupId: groupId }
    })
  })

  it('keeps the picked create-chat model with the workspace for its first-work naming', async () => {
    const store = createStore()
    register(store)

    const result = await invoke('projectlessChats:createWorkspace', {
      createdWithAgent: 'pi',
      createChatNaming: { model: 'anthropic/claude-x' }
    })

    expect(result).toMatchObject({
      ok: true,
      workspace: { createdWithAgent: 'pi', createChatNaming: { model: 'anthropic/claude-x' } }
    })
  })

  it('moves to a new id when the chosen folder already exists', async () => {
    let calls = 0
    // Why: the first chat takes ids from the first six draws, the second repeats them, the retry draws a new id.
    vi.spyOn(Math, 'random').mockImplementation(() => {
      calls += 1
      return calls <= 12 ? 0 : 0.5
    })
    const store = createStore()
    register(store)

    await invoke('projectlessChats:createWorkspace', {
      createdWithAgent: 'codex',
      createChatNaming: { model: null }
    })
    const second = await invoke('projectlessChats:createWorkspace', {
      createdWithAgent: 'codex',
      createChatNaming: { model: null }
    })

    const secondFolder = join(root, '2026-05-09', 'iiiiii')
    expect(second).toMatchObject({ ok: true, folderPath: secondFolder })
    expect(existsSync(join(root, '2026-05-09', '000000'))).toBe(true)
    expect(existsSync(secondFolder)).toBe(true)
    const chatGroups = store.getProjectGroups().filter((entry) => entry.parentPath === root)
    expect(chatGroups).toHaveLength(1)
  })

  it('reuses an existing local group that already points at the root', async () => {
    const store = createStore()
    register(store)
    const existing = store.createProjectGroup({
      name: 'My chats',
      parentPath: root,
      createdFrom: 'manual'
    })

    await invoke('projectlessChats:createWorkspace', {
      createdWithAgent: 'claude',
      createChatNaming: { model: null }
    })

    expect(store.getProjectGroups().filter((entry) => entry.parentPath === root)).toHaveLength(1)
    expect(store.getFolderWorkspaces()).toEqual([
      expect.objectContaining({ projectGroupId: existing.id })
    ])
  })

  it('refuses an SSH location without creating anything locally', async () => {
    const store = createStore()
    register(store)

    expect(
      await invoke('projectlessChats:createWorkspace', {
        createdWithAgent: 'claude',
        createChatNaming: { model: null },
        connectionId: 'ssh-1'
      })
    ).toEqual({ ok: false, code: 'ssh_location_unsupported' })
    expect(existsSync(root)).toBe(false)
    expect(store.getProjectGroups().some((entry) => entry.parentPath === root)).toBe(false)
  })
})
