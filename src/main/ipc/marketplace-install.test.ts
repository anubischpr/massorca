import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitInstallProgress, GitInstallStatus } from '../../shared/marketplace-install'
import { MARKETPLACE_GIT_PROGRESS_CHANNEL } from '../../shared/marketplace-install'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, args?: unknown) => unknown>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

import { registerMarketplaceInstallHandlers } from './marketplace-install'

const status: GitInstallStatus = { state: 'unverifiable', reason: 'probe-timeout' }

function fakeEvent(destroyed = false) {
  const send = vi.fn()
  return {
    event: { sender: { send, isDestroyed: () => destroyed } },
    send
  }
}

function fakeService() {
  return {
    status: vi.fn(async () => status),
    install: vi.fn(async (onProgress: (progress: GitInstallProgress) => void) => {
      onProgress({ stepId: 'install', status: 'running', logLine: 'Setting up git' })
      return { ok: false as const, reason: 'busy' as const, manualCommand: null, status }
    }),
    adopt: vi.fn(async () => ({ ok: true as const, status }))
  }
}

beforeEach(() => {
  handlers.clear()
})

describe('marketplaceInstall IPC', () => {
  it('registers one handler per Git install method', () => {
    registerMarketplaceInstallHandlers(fakeService())
    expect([...handlers.keys()].sort()).toEqual([
      'marketplaceInstall:adoptGit',
      'marketplaceInstall:getGitStatus',
      'marketplaceInstall:installGit'
    ])
  })

  it('answers the status request from the service', async () => {
    registerMarketplaceInstallHandlers(fakeService())
    const handler = handlers.get('marketplaceInstall:getGitStatus')
    expect(await handler?.({})).toEqual(status)
  })

  it('streams install progress only to the window that started the run', async () => {
    const service = fakeService()
    registerMarketplaceInstallHandlers(service)
    const { event, send } = fakeEvent()
    const result = await handlers.get('marketplaceInstall:installGit')?.(event)
    expect(result).toMatchObject({ ok: false, reason: 'busy' })
    expect(send).toHaveBeenCalledWith(MARKETPLACE_GIT_PROGRESS_CHANNEL, {
      stepId: 'install',
      status: 'running',
      logLine: 'Setting up git'
    })
  })

  it('drops progress for a window that has closed, without failing the run', async () => {
    const service = fakeService()
    registerMarketplaceInstallHandlers(service)
    const { event, send } = fakeEvent(true)
    await expect(handlers.get('marketplaceInstall:installGit')?.(event)).resolves.toBeDefined()
    expect(send).not.toHaveBeenCalled()
  })

  it('routes adopt through the service with the same progress sink', async () => {
    const service = fakeService()
    registerMarketplaceInstallHandlers(service)
    const { event } = fakeEvent()
    await handlers.get('marketplaceInstall:adoptGit')?.(event)
    expect(service.adopt).toHaveBeenCalledTimes(1)
  })
})
