// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketplaceEngramImport } from './MarketplaceEngramImport'
import { MarketplaceEngramProgram } from './MarketplaceEngramProgram'

const mocks = vi.hoisted(() => ({
  getProgram: vi.fn(),
  updateNow: vi.fn(),
  importMemories: vi.fn(),
  openUrl: vi.fn()
}))

const roots: Root[] = []

async function mount(node: React.JSX.Element): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(node)
  })
  return container
}

function button(container: ParentNode, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
  if (!found) {
    throw new Error(`No button "${text}"`)
  }
  return found
}

describe('Engram program and import', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    Object.assign(window, {
      api: {
        marketplaceEngramOps: {
          getProgram: mocks.getProgram,
          updateNow: mocks.updateNow,
          importMemories: mocks.importMemories
        },
        shell: { openUrl: mocks.openUrl }
      }
    })
  })

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount())
    }
    document.body.replaceChildren()
  })

  it('shows the version and the update the CLI reports', async () => {
    mocks.getProgram.mockResolvedValue({
      found: true,
      current: '3.3.2',
      latest: '3.6.0',
      updateAvailable: true
    })
    const container = await mount(<MarketplaceEngramProgram />)
    expect(container.textContent).toContain('3.3.2')
    expect(container.textContent).toContain('Update available 3.3.2 -> 3.6.0')
    expect(button(container, 'Update now')).toBeTruthy()
  })

  it('shows no update row when none is reported', async () => {
    mocks.getProgram.mockResolvedValue({
      found: true,
      current: '3.3.2',
      latest: null,
      updateAvailable: false
    })
    const container = await mount(<MarketplaceEngramProgram />)
    expect(container.textContent).toContain('3.3.2')
    expect(container.textContent).not.toContain('Update')
  })

  it('shows the manual instruction when Update now has no safe command', async () => {
    mocks.getProgram.mockResolvedValue({
      found: true,
      current: '3.3.2',
      latest: '3.6.0',
      updateAvailable: true
    })
    mocks.updateNow.mockResolvedValue({
      ok: false,
      reason: 'manual',
      instruction: 'Download the latest release and replace your Engram program.',
      url: 'https://example.test/releases'
    })
    const container = await mount(<MarketplaceEngramProgram />)
    await act(async () => {
      button(container, 'Update now').click()
    })
    expect(container.textContent).toContain('Download the latest release')
    await act(async () => {
      button(container, 'Open download page').click()
    })
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.test/releases')
  })

  it('shows the counts after an import', async () => {
    mocks.importMemories.mockResolvedValue({ ok: true, counts: { observations: 12, sessions: 3 } })
    const container = await mount(<MarketplaceEngramImport />)
    await act(async () => {
      button(container, 'Choose file').click()
    })
    expect(container.textContent).toContain('Imported: 12 observations, 3 sessions.')
  })

  it('says nothing when the picker is canceled and explains a bad file in plain words', async () => {
    mocks.importMemories.mockResolvedValueOnce({ ok: false, reason: 'canceled' })
    const container = await mount(<MarketplaceEngramImport />)
    await act(async () => {
      button(container, 'Choose file').click()
    })
    expect(container.querySelector('[role="status"]')).toBeNull()
    mocks.importMemories.mockResolvedValueOnce({ ok: false, reason: 'not-json' })
    await act(async () => {
      button(container, 'Choose file').click()
    })
    expect(container.textContent).toContain('Pick a .json file')
  })
})
