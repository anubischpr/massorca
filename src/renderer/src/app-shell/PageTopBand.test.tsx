/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppChromeLayout } from './use-app-chrome-layout'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./TitlebarLeftControls', () => ({
  TitlebarLeftControls: () => <div data-testid="left-controls" />
}))
vi.mock('./TitlebarMainStrip', () => ({
  TitlebarMainStrip: () => <div data-testid="main-strip" />
}))

const { PageTopBand } = await import('./PageTopBand')
const { TOP_BAR_SURFACE_CLASS } = await import('./top-bar-surface')

const layout = {} as AppChromeLayout
const mounted: HTMLElement[] = []

function render(withLeftControls: boolean): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  mounted.push(container)
  act(() =>
    createRoot(container).render(
      <PageTopBand layout={layout} withLeftControls={withLeftControls} />
    )
  )
  return container
}

afterEach(() => {
  for (const container of mounted.splice(0)) {
    container.remove()
  }
})

describe('PageTopBand', () => {
  it('is the 44px band that a page without a session bar gets in the center column', () => {
    const band = render(false).querySelector<HTMLElement>('[data-page-top-band]')
    expect(band?.className).toContain('h-11')
    expect(band?.querySelector('[data-testid="main-strip"]')).not.toBeNull()
  })

  it('is a window drag region that the terminal-focus release can still observe', () => {
    const band = render(false).querySelector<HTMLElement>('[data-page-top-band]')
    expect(band?.getAttribute('data-terminal-focus-release-surface')).toBe('true')
  })

  it('carries the sidebar toggle and history controls only when the sidebar column has none', () => {
    expect(render(true).querySelector('[data-testid="left-controls"]')).not.toBeNull()
    expect(render(false).querySelector('[data-testid="left-controls"]')).toBeNull()
  })

  it('uses the one top bar surface, the same token the session bar uses', () => {
    const band = render(false).querySelector<HTMLElement>('[data-page-top-band]')
    for (const token of TOP_BAR_SURFACE_CLASS.split(' ')) {
      expect(band?.className).toContain(token)
    }
  })
})
