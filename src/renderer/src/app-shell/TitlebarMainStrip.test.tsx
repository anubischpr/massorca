/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => children,
  TooltipContent: ({ children }: { children?: ReactNode }) => <span>{children}</span>
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('../hooks/useShortcutLabel', () => ({ useShortcutLabel: () => 'Ctrl+B' }))
vi.mock('../components/activity/ActivityTitlebarControls', () => ({
  ActivityTitlebarControls: () => null
}))
vi.mock('./app-window-chrome', () => ({ hasCustomTitleBar: true }))

const { createTestStore } = await import('../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../store', () => ({ useAppStore: store }))

const { TitlebarMainStrip } = await import('./TitlebarMainStrip')
const { usePageTopBandActionsTarget } = await import('./page-top-band-slot')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function Page(): React.JSX.Element | null {
  const target = usePageTopBandActionsTarget()
  return target ? createPortal(<button aria-label="Hide panel" />, target) : null
}

function mount(layout: React.ComponentProps<typeof TitlebarMainStrip>['layout']): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <>
        <TitlebarMainStrip layout={layout} />
        <Page />
      </>
    )
  )
  return container
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('TitlebarMainStrip page actions', () => {
  it('lets the page put its own toggle in the top band, right before the window controls', () => {
    const container = mount({
      activeView: 'prototypes',
      showRightSidebarControls: false,
      rightSidebarOpen: false,
      workspaceChromeActive: false
    })
    const slot = container.querySelector('[data-page-top-band-actions]')
    expect(slot?.querySelector('button[aria-label="Hide panel"]')).not.toBeNull()
    expect(slot?.nextElementSibling?.className).toContain('window-controls-titlebar-spacer')
  })

  it('keeps the right sidebar toggle between the page actions and the window controls', () => {
    const container = mount({
      activeView: 'bot-teams',
      showRightSidebarControls: true,
      rightSidebarOpen: false,
      workspaceChromeActive: false
    })
    const slot = container.querySelector('[data-page-top-band-actions]')
    expect(slot?.nextElementSibling?.getAttribute('aria-label')).toBe('Toggle right sidebar')
  })

  it('keeps the right sidebar toggle in the band while the sidebar is open, marked pressed', () => {
    store.setState({ rightSidebarOpen: true })
    const container = mount({
      activeView: 'prototypes',
      showRightSidebarControls: true,
      rightSidebarOpen: true,
      workspaceChromeActive: false
    })
    const toggle = container.querySelector('button[aria-label="Toggle right sidebar"]')
    expect(toggle?.getAttribute('aria-pressed')).toBe('true')
  })
})
