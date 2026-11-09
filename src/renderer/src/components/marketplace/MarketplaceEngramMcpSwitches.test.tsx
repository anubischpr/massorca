// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceDetection } from '../../../../shared/marketplace-types'
import { marketplaceAgentLabel } from './marketplace-catalog'
import { MarketplaceEngramMcpSwitches } from './MarketplaceEngramMcpSwitches'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

const roots: { container: HTMLDivElement; root: Root }[] = []

function detection(
  cli: 'found' | 'missing',
  agents: MarketplaceDetection['engram']['agents']
): MarketplaceDetection {
  const none = { reader: 'missing', writer: 'missing' } as const
  return {
    engram: { cli, store: 'found', agents },
    openMetadata: { agents: { claude: none, codex: none } }
  }
}

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(<MarketplaceEngramMcpSwitches />)
  })
  await act(async () => {})
  return container
}

function switchFor(container: ParentNode, agent: 'claude' | 'codex'): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(
    `[role="switch"][aria-label="Engram MCP server for ${marketplaceAgentLabel(agent)}"]`
  )
}

afterEach(() => {
  for (const { container, root } of roots.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('MarketplaceEngramMcpSwitches', () => {
  it('shows each agent as on or off from the detection', async () => {
    Object.assign(window, {
      api: {
        marketplace: {
          detect: vi.fn(async () => detection('found', { claude: 'set', codex: 'missing' })),
          setEngramMcp: vi.fn()
        }
      }
    })
    const container = await mount()
    expect(switchFor(container, 'claude')?.getAttribute('aria-checked')).toBe('true')
    expect(switchFor(container, 'codex')?.getAttribute('aria-checked')).toBe('false')
  })

  it('switches one agent and reads the detection again', async () => {
    const detect = vi.fn(async () => detection('found', { claude: 'set', codex: 'missing' }))
    const setEngramMcp = vi.fn(async () => ({ ok: true }))
    Object.assign(window, { api: { marketplace: { detect, setEngramMcp } } })
    const container = await mount()
    await act(async () => {
      switchFor(container, 'codex')?.click()
    })
    expect(setEngramMcp).toHaveBeenCalledWith({ agent: 'codex', enabled: true })
    expect(detect).toHaveBeenCalledTimes(2)
  })

  it('disables the switches while Engram is not installed', async () => {
    Object.assign(window, {
      api: {
        marketplace: {
          detect: vi.fn(async () => detection('missing', { claude: 'missing', codex: 'missing' })),
          setEngramMcp: vi.fn()
        }
      }
    })
    const container = await mount()
    expect(switchFor(container, 'claude')?.disabled).toBe(true)
  })

  it('renders nothing when this computer cannot be checked', async () => {
    Object.assign(window, {
      api: {
        marketplace: {
          detect: vi.fn(async () => {
            throw new Error('offline')
          }),
          setEngramMcp: vi.fn()
        }
      }
    })
    const container = await mount()
    expect(container.innerHTML).toBe('')
  })
})
