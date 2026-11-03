// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceDetection } from '../../../../shared/marketplace-types'
import { EngramDetail } from './EngramDetail'

const mocks = vi.hoisted(() => ({
  setEngramMcp: vi.fn()
}))

const roots: Root[] = []

function detection(overrides: Partial<MarketplaceDetection['engram']> = {}): MarketplaceDetection {
  return {
    engram: {
      cli: 'found',
      store: 'found',
      agents: { claude: 'set', codex: 'missing' },
      ...overrides
    },
    openMetadata: {
      agents: {
        claude: { reader: 'missing', writer: 'missing' },
        codex: { reader: 'missing', writer: 'missing' }
      }
    }
  }
}

async function renderDetail(
  engram: MarketplaceDetection,
  onChanged: () => Promise<void> = async () => {}
): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<EngramDetail detection={engram} onChanged={onChanged} />)
  })
  return container
}

function switchFor(container: ParentNode, label: string): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`)
}

describe('EngramDetail', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.setEngramMcp.mockResolvedValue({ ok: true, state: 'missing' })
    Object.assign(window, {
      api: { marketplace: { detect: vi.fn(), setEngramMcp: mocks.setEngramMcp } }
    })
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount())
    })
    document.body.replaceChildren()
  })

  it('shows the MCP switch on only for an agent whose entry is set', async () => {
    const container = await renderDetail(detection())

    expect(
      switchFor(container, 'Engram MCP server for Claude Code')?.getAttribute('aria-checked')
    ).toBe('true')
    expect(switchFor(container, 'Engram MCP server for Codex')?.getAttribute('aria-checked')).toBe(
      'false'
    )
  })

  it('turns the Claude Code entry off through the bridge and refreshes the detection', async () => {
    const onChanged = vi.fn(async () => {})
    const container = await renderDetail(detection(), onChanged)

    await act(async () => {
      switchFor(container, 'Engram MCP server for Claude Code')?.click()
    })

    expect(mocks.setEngramMcp).toHaveBeenCalledWith({ agent: 'claude', enabled: false })
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('explains why a refused change did not apply', async () => {
    mocks.setEngramMcp.mockResolvedValue({ ok: false, reason: 'unreadable' })
    const container = await renderDetail(detection())

    await act(async () => {
      switchFor(container, 'Engram MCP server for Claude Code')?.click()
    })

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not change Claude Code's settings: the settings file could not be read."
    )
  })

  it('disables the switches and asks for the program when Engram is not installed', async () => {
    const container = await renderDetail(detection({ cli: 'missing' }))

    expect(switchFor(container, 'Engram MCP server for Claude Code')?.disabled).toBe(true)
    expect(switchFor(container, 'Engram MCP server for Codex')?.disabled).toBe(true)
    expect(container.textContent).toContain('Install Engram on this computer first.')
  })

  it('disables the switch and says so when the settings file cannot be read', async () => {
    const container = await renderDetail(
      detection({ agents: { claude: 'unreadable', codex: 'missing' } })
    )

    expect(switchFor(container, 'Engram MCP server for Claude Code')?.disabled).toBe(true)
    expect(container.textContent).toContain('Settings file could not be read')
  })
})
