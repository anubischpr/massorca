/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const toastInfo = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { info: toastInfo, message: toastInfo } }))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => children,
  TooltipContent: ({ children }: { children?: ReactNode }) => <span>{children}</span>
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/hooks/useShortcutLabel', () => ({
  useShortcutKeyDetails: () => ({ keys: [], doubleTap: false })
}))
vi.mock('@/components/ShortcutKeyCombo', () => ({ ShortcutKeyCombo: () => null }))
vi.mock('./AppRailUsage', () => ({ AppRailUsage: () => null }))

const { createGlobalSettingsFixture } = await import('../../../shared/global-settings-test-fixture')
const { createTestStore, seedStore } = await import('../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../store', () => ({ useAppStore: store }))

const { AppRail } = await import('./AppRail')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function mount(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<AppRail />))
  return container
}

function modeButton(container: ParentNode): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('nav button')
  if (!button) {
    throw new Error('Rail mode button missing')
  }
  return button
}

beforeEach(() => {
  toastInfo.mockReset()
  seedStore(store, {
    activeView: 'terminal',
    railMode: 'workspaces',
    railWorkspacesHintShown: false
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the rail mode button', () => {
  it('reads Workspaces in its own mode and Bot teams after switching, label and tooltip alike', () => {
    const container = mount()
    expect(modeButton(container).getAttribute('aria-label')).toBe('Workspaces')
    act(() => modeButton(container).click())
    expect(modeButton(container).getAttribute('aria-label')).toBe('Bot teams')
    expect(container.textContent).toContain('Bot teams')
    expect(store.getState().activeView).toBe('bot-teams')
    act(() => modeButton(container).click())
    expect(modeButton(container).getAttribute('aria-label')).toBe('Workspaces')
  })

  it('keeps the mode label while Tasks is the page, and returns to Bot teams without switching', () => {
    const container = mount()
    act(() => modeButton(container).click())
    act(() => store.getState().openTasksHome())
    expect(modeButton(container).getAttribute('aria-label')).toBe('Bot teams')
    act(() => modeButton(container).click())
    expect(store.getState().activeView).toBe('bot-teams')
    expect(modeButton(container).getAttribute('aria-label')).toBe('Bot teams')
  })

  it('crossfades both icons with CSS and no motion under reduced motion', () => {
    const container = mount()
    const icons = [...modeButton(container).querySelectorAll('svg')]
    expect(icons).toHaveLength(2)
    for (const icon of icons) {
      expect(icon.getAttribute('class')).toContain('motion-reduce:transition-none')
      // Why: Tailwind scale-* sets the `scale` property, which `transform` transitions do not cover.
      expect(icon.getAttribute('class')).toContain('transition-[opacity,scale]')
    }
    expect(modeButton(container).querySelector('[data-mode]')?.getAttribute('data-mode')).toBe(
      'workspaces'
    )
  })
})

describe('the Calendar button', () => {
  it('sits after Tasks, opens the Calendar page and marks itself current there', () => {
    const container = mount()
    const labels = [...container.querySelectorAll('nav button')].map((b) =>
      b.getAttribute('aria-label')
    )
    expect(labels.slice(0, 3)).toEqual(['Workspaces', 'Tasks', 'Calendar'])
    const calendar = container.querySelector<HTMLButtonElement>('button[aria-label="Calendar"]')!
    expect(calendar.getAttribute('aria-current')).toBeNull()
    act(() => calendar.click())
    expect(store.getState().activeView).toBe('calendar')
    expect(calendar.getAttribute('aria-current')).toBe('page')
  })
})

describe('the Marketplace button', () => {
  it('sits after Calendar, opens the Marketplace page and marks itself current there', () => {
    const container = mount()
    const labels = [...container.querySelectorAll('nav button')].map((b) =>
      b.getAttribute('aria-label')
    )
    expect(labels.slice(0, 4)).toEqual(['Workspaces', 'Tasks', 'Calendar', 'Marketplace'])
    const marketplace = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Marketplace"]'
    )!
    expect(marketplace.getAttribute('aria-current')).toBeNull()
    act(() => marketplace.click())
    expect(store.getState().activeView).toBe('marketplace')
    expect(marketplace.getAttribute('aria-current')).toBe('page')
  })
})

describe('the theme button', () => {
  function themeButton(container: ParentNode): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('button[data-theme-toggle]')
    if (!button) {
      throw new Error('Theme button missing')
    }
    return button
  }

  function mountWithTheme(theme: 'system' | 'dark' | 'light', systemDark = false) {
    const updateSettings = vi.fn(async () => {})
    seedStore(store, {
      settings: { ...createGlobalSettingsFixture({ workspaceDir: '/w' }), theme },
      updateSettings
    })
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: systemDark && query === '(prefers-color-scheme: dark)',
      addEventListener: () => {},
      removeEventListener: () => {}
    }))
    return { container: mount(), updateSettings }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sits just above the usage meter and switches a dark app to light', () => {
    const { container, updateSettings } = mountWithTheme('dark')
    const labels = [...container.querySelectorAll('nav button')].map((b) =>
      b.getAttribute('aria-label')
    )
    expect(labels.slice(-2)).toEqual(['Switch to light mode', 'Settings'])
    expect(container.textContent).toContain('Switch to light mode')
    act(() => themeButton(container).click())
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'light' })
  })

  it('switches a light app to dark', () => {
    const { container, updateSettings } = mountWithTheme('light')
    expect(themeButton(container).getAttribute('aria-label')).toBe('Switch to dark mode')
    act(() => themeButton(container).click())
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark' })
  })

  it('on the system theme, saves the opposite of what the system shows', () => {
    const dark = mountWithTheme('system', true)
    expect(themeButton(dark.container).getAttribute('aria-label')).toBe('Switch to light mode')
    act(() => themeButton(dark.container).click())
    expect(dark.updateSettings).toHaveBeenCalledWith({ theme: 'light' })
  })
})

describe('the Workspaces again hint', () => {
  it('shows once, when Workspaces home is reached again from another page through the button', () => {
    seedStore(store, { activeView: 'tasks' })
    const container = mount()
    act(() => modeButton(container).click())
    expect(toastInfo).toHaveBeenCalledTimes(1)
    // Why: the default 4s in the far corner went unnoticed, so the hint stays longer and sits mid-window.
    expect(toastInfo).toHaveBeenCalledWith('Click Workspaces again to switch to Bot teams.', {
      duration: 8000,
      position: 'bottom-center'
    })
    expect(store.getState().railWorkspacesHintShown).toBe(true)

    act(() => store.getState().openTasksHome())
    act(() => modeButton(container).click())
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('does not show when the click switches mode, or when the mode is Bot teams', () => {
    const container = mount()
    act(() => modeButton(container).click())
    expect(toastInfo).not.toHaveBeenCalled()
    act(() => store.getState().openTasksHome())
    act(() => modeButton(container).click())
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('stays quiet once it was shown in an earlier session', () => {
    seedStore(store, { activeView: 'tasks', railWorkspacesHintShown: true })
    const container = mount()
    act(() => modeButton(container).click())
    expect(toastInfo).not.toHaveBeenCalled()
  })
})
