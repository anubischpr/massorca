import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalCommandProbe } from './preflight-command-exec'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, args?: unknown) => unknown>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

import type { CustomItemEnv } from '../marketplace/custom/custom-item-env'
import { createCustomItemService } from '../marketplace/custom/custom-item-service'
import { createCustomItemStore } from '../marketplace/custom/custom-item-store'
import {
  MARKETPLACE_CUSTOM_INSTALL_EVENT_CHANNEL,
  registerMarketplaceCustomHandlers
} from './marketplace-custom'

const winget: LocalCommandProbe = { status: 'available', binary: 'C:/Windows/winget.exe' }
const invalid = { ok: false, reason: 'invalid-input' }

let dir = ''

beforeEach(() => {
  handlers.clear()
  dir = mkdtempSync(join(tmpdir(), 'orca-custom-ipc-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function fakeEvent(destroyed = false) {
  const send = vi.fn()
  return { event: { sender: { send, isDestroyed: () => destroyed } }, send }
}

/** A Windows machine where only winget is installed; installs succeed unless a test says otherwise. */
function makeService(overrides: Partial<CustomItemEnv> = {}) {
  const env: CustomItemEnv = {
    platform: 'win32',
    findCommand: async (command) => (command === 'winget' ? winget : { status: 'absent' }),
    runCheck: async () => ({ code: 0, timedOut: false }),
    runInstall: async () => ({ code: 0, timedOut: false }),
    store: createCustomItemStore(join(dir, 'custom.json')),
    now: () => 1_000,
    newId: () => 'item-1',
    ...overrides
  }
  return createCustomItemService(env)
}

const toolArgs = {
  kind: 'tool',
  name: 'MyTool',
  checkCommand: 'mytool --version',
  install: { win32: 'winget install mytool' }
}

describe('marketplaceCustom IPC', () => {
  it('registers one handler per custom item method', () => {
    registerMarketplaceCustomHandlers(makeService())
    expect([...handlers.keys()].sort()).toEqual([
      'marketplaceCustom:add',
      'marketplaceCustom:install',
      'marketplaceCustom:list',
      'marketplaceCustom:remove'
    ])
  })

  it('answers the list request from the service', async () => {
    registerMarketplaceCustomHandlers(makeService())
    await expect(handlers.get('marketplaceCustom:list')?.({})).resolves.toEqual([])
  })

  it('stores a valid add and answers with the new item', async () => {
    registerMarketplaceCustomHandlers(makeService())
    await expect(handlers.get('marketplaceCustom:add')?.({}, toolArgs)).resolves.toMatchObject({
      ok: true,
      item: { name: 'MyTool', presence: 'missing' }
    })
  })

  it('answers invalid-input for arguments it cannot accept, and touches no file', async () => {
    registerMarketplaceCustomHandlers(makeService())
    const add = handlers.get('marketplaceCustom:add')
    await expect(
      add?.({}, { kind: 'tool', name: 'Tool', checkCommand: 'tool | more' })
    ).resolves.toEqual(invalid)
    await expect(add?.({}, 'not an object')).resolves.toEqual(invalid)
    await expect(handlers.get('marketplaceCustom:remove')?.({}, { id: '' })).resolves.toEqual(
      invalid
    )
    await expect(handlers.get('marketplaceCustom:install')?.({}, { id: 1 })).resolves.toEqual(
      invalid
    )
    expect(existsSync(join(dir, 'custom.json'))).toBe(false)
  })

  it('streams install events only to the window that started the run', async () => {
    registerMarketplaceCustomHandlers(
      makeService({
        runInstall: async (_argv, onLine) => {
          onLine('Installing mytool')
          return { code: 0, timedOut: false }
        }
      })
    )
    await handlers.get('marketplaceCustom:add')?.({}, toolArgs)
    const { event, send } = fakeEvent()
    await handlers.get('marketplaceCustom:install')?.(event, { id: 'item-1' })
    expect(send).toHaveBeenCalledWith(MARKETPLACE_CUSTOM_INSTALL_EVENT_CHANNEL, {
      id: 'item-1',
      status: 'running',
      logLine: 'Installing mytool'
    })
    expect(send).toHaveBeenLastCalledWith(MARKETPLACE_CUSTOM_INSTALL_EVENT_CHANNEL, {
      id: 'item-1',
      status: 'failed',
      logLine: 'The check command still does not find it.'
    })
  })

  it('drops install events for a window that has closed, without failing the run', async () => {
    registerMarketplaceCustomHandlers(makeService())
    await handlers.get('marketplaceCustom:add')?.({}, toolArgs)
    const { event, send } = fakeEvent(true)
    await expect(
      handlers.get('marketplaceCustom:install')?.(event, { id: 'item-1' })
    ).resolves.toMatchObject({ ok: false })
    expect(send).not.toHaveBeenCalled()
  })
})
