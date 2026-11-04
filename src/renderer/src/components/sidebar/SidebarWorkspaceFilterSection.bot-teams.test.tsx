// @vitest-environment happy-dom

/**
 * "Show bot teams" is a visibility switch, not a narrowing filter: it starts off,
 * so the sidebar hides team folders and bot sessions until the user turns it on.
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))

import SidebarWorkspaceFilterSection from './SidebarWorkspaceFilterSection'

const SHOW_BOT_TEAMS_LABEL = 'Show bot teams'

function setState(overrides: Record<string, unknown> = {}): void {
  mocks.state = {
    showSleepingWorkspaces: true,
    setShowSleepingWorkspaces: vi.fn(),
    hideDefaultBranchWorkspace: false,
    setHideDefaultBranchWorkspace: vi.fn(),
    hideAutomationGeneratedWorkspaces: false,
    setHideAutomationGeneratedWorkspaces: vi.fn(),
    hideCliCreatedWorkspaces: false,
    setHideCliCreatedWorkspaces: vi.fn(),
    hideDetachedHeadWorkspaces: false,
    setHideDetachedHeadWorkspaces: vi.fn(),
    hideWorkspacesFromOtherDevices: false,
    setHideWorkspacesFromOtherDevices: vi.fn(),
    runtimeEnvironments: [],
    runtimeEnvironmentCatalogHydrated: true,
    alwaysShowDefaultBranchWorkspace: true,
    setAlwaysShowDefaultBranchWorkspace: vi.fn(),
    showBotTeamWorkspaces: false,
    setShowBotTeamWorkspaces: vi.fn(),
    ...overrides
  }
}

let container: HTMLDivElement
let root: Root

function render(): void {
  act(() => {
    root.render(<SidebarWorkspaceFilterSection />)
  })
}

function botTeamSwitch(): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="switch"]')).find(
    (el) => el.textContent?.trim() === SHOW_BOT_TEAMS_LABEL
  )
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  setState()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('SidebarWorkspaceFilterSection Show bot teams switch', () => {
  it('renders the switch off by default', () => {
    render()
    expect(botTeamSwitch()?.getAttribute('aria-checked')).toBe('false')
  })

  it('turns bot-team workspaces on when the switch is clicked', () => {
    const setShowBotTeamWorkspaces = vi.fn()
    setState({ setShowBotTeamWorkspaces })
    render()
    act(() => {
      botTeamSwitch()?.click()
    })
    expect(setShowBotTeamWorkspaces).toHaveBeenCalledWith(true)
  })
})
