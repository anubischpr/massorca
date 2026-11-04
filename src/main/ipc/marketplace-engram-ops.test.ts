import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, () => unknown>())

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: () => unknown) => handlers.set(channel, fn) }
}))

const { registerMarketplaceEngramOpsHandlers } = await import('./marketplace-engram-ops')

describe('registerMarketplaceEngramOpsHandlers', () => {
  beforeEach(() => handlers.clear())

  it('routes each channel to the service', async () => {
    const service = {
      getProgram: vi.fn(async () => ({
        found: true,
        current: '3.3.2',
        latest: null,
        updateAvailable: false
      })),
      updateNow: vi.fn(async () => ({ ok: false as const, reason: 'manual' as const })),
      importMemories: vi.fn(async () => ({ ok: false as const, reason: 'canceled' as const }))
    }
    registerMarketplaceEngramOpsHandlers(service)
    expect([...handlers.keys()].sort()).toEqual([
      'marketplaceEngramOps:getProgram',
      'marketplaceEngramOps:importMemories',
      'marketplaceEngramOps:updateNow'
    ])
    await handlers.get('marketplaceEngramOps:getProgram')?.()
    await handlers.get('marketplaceEngramOps:updateNow')?.()
    await handlers.get('marketplaceEngramOps:importMemories')?.()
    expect(service.getProgram).toHaveBeenCalledTimes(1)
    expect(service.updateNow).toHaveBeenCalledTimes(1)
    expect(service.importMemories).toHaveBeenCalledTimes(1)
  })
})
