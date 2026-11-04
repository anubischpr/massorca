import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown, args?: unknown) => unknown

const handlers = vi.hoisted(() => new Map<string, Handler>())

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) }
}))

const { registerMarketplaceEngramOpsHandlers } = await import('./marketplace-engram-ops')

describe('registerMarketplaceEngramOpsHandlers', () => {
  beforeEach(() => handlers.clear())

  function fakeService() {
    return {
      getProgram: vi.fn(async () => ({
        found: true,
        current: '3.3.2',
        latest: null,
        updateAvailable: false
      })),
      updateNow: vi.fn(async () => ({ ok: false as const, reason: 'manual' as const })),
      importMemories: vi.fn(async () => ({ ok: false as const, reason: 'canceled' as const })),
      listCloudProjects: vi.fn(async () => ({ ok: true as const, projects: [] })),
      enrollCloudProject: vi.fn(async () => ({ ok: true as const })),
      syncCloudProject: vi.fn(async () => ({ ok: true as const }))
    }
  }

  it('routes each channel to the service', async () => {
    const service = fakeService()
    registerMarketplaceEngramOpsHandlers(service)
    expect([...handlers.keys()].sort()).toEqual([
      'marketplaceEngramOps:enrollCloudProject',
      'marketplaceEngramOps:getProgram',
      'marketplaceEngramOps:importMemories',
      'marketplaceEngramOps:listCloudProjects',
      'marketplaceEngramOps:syncCloudProject',
      'marketplaceEngramOps:updateNow'
    ])
    await handlers.get('marketplaceEngramOps:getProgram')?.({})
    await handlers.get('marketplaceEngramOps:updateNow')?.({})
    await handlers.get('marketplaceEngramOps:importMemories')?.({})
    await handlers.get('marketplaceEngramOps:listCloudProjects')?.({})
    expect(service.getProgram).toHaveBeenCalledTimes(1)
    expect(service.updateNow).toHaveBeenCalledTimes(1)
    expect(service.importMemories).toHaveBeenCalledTimes(1)
    expect(service.listCloudProjects).toHaveBeenCalledTimes(1)
  })

  it('hands the project name to enroll and sync, and an empty name when the input is malformed', async () => {
    const service = fakeService()
    registerMarketplaceEngramOpsHandlers(service)
    await handlers.get('marketplaceEngramOps:enrollCloudProject')?.({}, { name: 'massorca' })
    await handlers.get('marketplaceEngramOps:syncCloudProject')?.({}, { name: 'massorca' })
    await handlers.get('marketplaceEngramOps:syncCloudProject')?.({}, { name: 42 })
    await handlers.get('marketplaceEngramOps:syncCloudProject')?.({}, undefined)
    expect(service.enrollCloudProject).toHaveBeenCalledWith('massorca')
    expect(service.syncCloudProject.mock.calls).toEqual([['massorca'], [''], ['']])
  })
})
