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
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  function register(store: ReturnType<typeof createStore>): void {
    store.updateSettings({ projectlessChatsDir: root })
    registerProjectlessChatHandlers(new BrowserWindow(), store, {
      now: () => NOW
    })
  }

  it('creates a dated folder workspace under the configured root with a Chats group', async () => {
    const store = createStore()
    register(store)

    const expectedFolder = join(root, '2026-05-09', 'plan-q3-launch')
    const result = await invoke('projectlessChats:createWorkspace', {
      title: 'Plan Q3 launch'
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
      name: 'Plan Q3 launch'
    })
    expect(result).toMatchObject({
      ok: true,
      folderPath: expectedFolder,
      workspaceKey: `folder:${workspace?.id}`,
      workspace: { id: workspace?.id, projectGroupId: groupId }
    })
  })

  it('suffixes a colliding chat folder and reuses the one projectless group', async () => {
    const store = createStore()
    register(store)

    await invoke('projectlessChats:createWorkspace', { title: 'Fix login' })
    const second = await invoke('projectlessChats:createWorkspace', {
      title: 'Fix login'
    })

    const secondFolder = join(root, '2026-05-09', 'fix-login-2')
    expect(second).toMatchObject({ ok: true, folderPath: secondFolder })
    expect(existsSync(join(root, '2026-05-09', 'fix-login'))).toBe(true)
    expect(existsSync(secondFolder)).toBe(true)
    const chatGroups = store.getProjectGroups().filter((entry) => entry.parentPath === root)
    expect(chatGroups).toHaveLength(1)
    const folders = store
      .getFolderWorkspaces()
      .filter((entry) => entry.projectGroupId === chatGroups[0].id)
    expect(folders.map((entry) => entry.folderPath).sort()).toEqual(
      [join(root, '2026-05-09', 'fix-login'), secondFolder].sort()
    )
  })

  it('reuses an existing local group that already points at the root', async () => {
    const store = createStore()
    register(store)
    const existing = store.createProjectGroup({
      name: 'My chats',
      parentPath: root,
      createdFrom: 'manual'
    })

    await invoke('projectlessChats:createWorkspace', { title: 'Hello' })

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
        title: 'Remote',
        connectionId: 'ssh-1'
      })
    ).toEqual({ ok: false, code: 'ssh_location_unsupported' })
    expect(existsSync(root)).toBe(false)
    expect(store.getProjectGroups().some((entry) => entry.parentPath === root)).toBe(false)
  })
})
