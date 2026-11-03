// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import MarketplacePage from './MarketplacePage'

const mocks = vi.hoisted((): { state: Record<string, unknown> } => ({
  state: {}
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))

vi.mock('@/lib/local-preflight-context', () => ({
  getLocalPreflightContext: () => ({}),
  localPreflightContextKey: () => 'local'
}))

const roots: Root[] = []

async function renderPage(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplacePage />
      </TooltipProvider>
    )
  })
  return container
}

// Why: badges also carry font-medium, so the row name is matched by its block layout class.
const NAME_SELECTOR = 'span.block.font-medium'

function rowFor(container: ParentNode, name: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('li button')).find(
    (button) => button.querySelector(NAME_SELECTOR)?.textContent === name
  )
}

function clickButtonWithText(container: ParentNode, text: string): Promise<void> {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return act(async () => {
    button.click()
  })
}

function listedNames(container: ParentNode): string[] {
  return Array.from(container.querySelectorAll(`li ${NAME_SELECTOR}`)).map(
    (name) => name.textContent ?? ''
  )
}

describe('MarketplacePage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    // Why: the web client has no marketplace bridge; the page must still render.
    Object.assign(window, { api: undefined })
    mocks.state = {
      closeMarketplacePage: vi.fn(),
      preflightStatus: {
        git: { installed: true },
        gh: { installed: true, authenticated: false }
      },
      preflightStatusChecked: true,
      preflightStatusContextKey: 'local',
      refreshPreflightStatus: vi.fn()
    }
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount())
    })
    document.body.replaceChildren()
  })

  it('lists the four items with the status known on this computer', async () => {
    const container = await renderPage()

    const badgeFor = (name: string): string | null | undefined =>
      rowFor(container, name)?.querySelector('[data-slot="badge"]')?.textContent

    expect(listedNames(container)).toEqual(['Git', 'GitHub', 'Engram', 'OpenMetadata'])
    expect(badgeFor('Git')).toBe('Installed')
    expect(badgeFor('GitHub')).toBe('Not signed in')
    expect(badgeFor('Engram')).toBe('Available in the desktop app')
    expect(badgeFor('OpenMetadata')).toBe('Available in the desktop app')
    expect(container.textContent).toContain(
      'Only this computer for now. SSH and WSL hosts come later.'
    )
  })

  it('filters the list by section', async () => {
    const container = await renderPage()

    await clickButtonWithText(container, 'Tools')

    expect(listedNames(container)).toEqual(['Git', 'Engram'])
  })

  it('opens a detail from its row and returns to the list with Back', async () => {
    const container = await renderPage()

    await act(async () => {
      rowFor(container, 'Git')?.click()
    })
    expect(container.textContent).toContain('Git is installed on this computer.')

    await clickButtonWithText(container, 'Back')

    expect(listedNames(container)).toEqual(['Git', 'GitHub', 'Engram', 'OpenMetadata'])
  })
})
