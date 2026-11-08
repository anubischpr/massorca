// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketplaceEngramCloud } from './MarketplaceEngramCloud'

const mocks = vi.hoisted(() => ({
  listCloudProjects: vi.fn(),
  syncCloudProject: vi.fn()
}))

const roots: Root[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<MarketplaceEngramCloud />)
  })
  return container
}

function buttons(container: ParentNode, text: string): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')].filter((b) => b.textContent?.includes(text))
}

describe('Engram cloud rows', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    Object.assign(window, {
      api: {
        marketplaceEngramOps: {
          listCloudProjects: mocks.listCloudProjects,
          syncCloudProject: mocks.syncCloudProject
        }
      }
    })
  })

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount())
    }
    document.body.replaceChildren()
  })

  it('shows one row per project with its sync state and a button', async () => {
    mocks.listCloudProjects.mockResolvedValue({
      ok: true,
      projects: [
        { name: 'massorca', lastSyncedAt: Date.now() - 4 * 60_000 },
        { name: 'notes', lastSyncedAt: null }
      ]
    })
    const container = await mount()
    expect(container.textContent).toContain('massorca')
    expect(container.textContent).toContain('Synced 4 minutes ago')
    expect(container.textContent).toContain('notes')
    expect(container.textContent).toContain('Not synced')
    expect(buttons(container, 'Sync this project')).toHaveLength(2)
  })

  it('syncs one project and updates its row', async () => {
    mocks.listCloudProjects.mockResolvedValue({
      ok: true,
      projects: [{ name: 'notes', lastSyncedAt: null }]
    })
    mocks.syncCloudProject.mockResolvedValue({ ok: true, lastSyncedAt: Date.now() })
    const container = await mount()
    await act(async () => {
      buttons(container, 'Sync this project')[0].click()
    })
    expect(mocks.syncCloudProject).toHaveBeenCalledWith({ name: 'notes' })
    expect(container.textContent).not.toContain('Not synced')
    expect(container.textContent).toContain('Synced')
  })

  it('explains a failed sync in plain words', async () => {
    mocks.listCloudProjects.mockResolvedValue({
      ok: true,
      projects: [{ name: 'notes', lastSyncedAt: null }]
    })
    mocks.syncCloudProject.mockResolvedValue({ ok: false, reason: 'failed' })
    const container = await mount()
    await act(async () => {
      buttons(container, 'Sync this project')[0].click()
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'The sync did not complete'
    )
    expect(container.textContent).toContain('Not synced')
  })

  it('explains why the projects could not be listed', async () => {
    mocks.listCloudProjects.mockResolvedValue({ ok: false, reason: 'no-server' })
    const container = await mount()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Add your Engram server address and sign-in'
    )
    expect(buttons(container, 'Sync this project')).toHaveLength(0)
  })
})
