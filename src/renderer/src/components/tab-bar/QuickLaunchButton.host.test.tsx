// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useDetectedAgents: vi.fn((target: { kind: string }) => ({
    detectedIds: target.kind === 'runtime' ? ['claude', 'pi'] : ['claude', 'opencode']
  })),
  launchAgentInNewTab: vi.fn()
}))

vi.mock('@/hooks/useDetectedAgents', () => ({ useDetectedAgents: mocks.useDetectedAgents }))
vi.mock('@/hooks/useAgentDetectionTarget', () => ({
  useAgentDetectionTargetForWorktree: () => ({ kind: 'local' })
}))
vi.mock('@/hooks/useShortcutLabel', () => ({ useOptionalShortcutLabel: () => null }))
vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => 'gentle-shell' }))
vi.mock('@/store', () => {
  const state = {
    settings: { defaultTuiAgent: 'claude', disabledTuiAgents: [] },
    openSettingsPage: vi.fn(),
    openSettingsTarget: vi.fn()
  }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})
vi.mock('@/lib/agent-catalog', () => ({
  getAgentCatalog: () => [
    { id: 'claude', label: 'Claude' },
    { id: 'opencode', label: 'OpenCode' },
    { id: 'pi', label: 'Pi' }
  ],
  AgentIcon: ({ agent }: { agent: string }) => <span>{agent}</span>
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <div role="menuitem" onClick={onSelect}>
      {children}
    </div>
  ),
  DropdownMenuShortcut: ({ children }: { children: ReactNode }) => <span>{children}</span>
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), message: vi.fn() } }))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab: mocks.launchAgentInNewTab }))

import { QuickLaunchAgentMenuItems } from './QuickLaunchButton'

const agentRows = (): (string | null)[] =>
  screen
    .getAllByRole('menuitem')
    .map((row) => row.querySelector('.flex-1')?.textContent ?? null)
    .filter((label) => label !== null)

describe('the "+" agent rows of a strip that follows a paired host', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists only the agents the host detects, naming Gentle Shell, and starts them there', () => {
    const launchAgent = vi.fn()
    render(
      <QuickLaunchAgentMenuItems
        worktreeId="floating"
        groupId="g"
        onFocusTerminal={vi.fn()}
        host={{ environmentId: 'vps-env', worktreeId: 'vps-worktree', launchAgent }}
      />
    )
    expect(mocks.useDetectedAgents).toHaveBeenLastCalledWith({
      kind: 'runtime',
      environmentId: 'vps-env'
    })
    expect(agentRows()).toEqual(['Claude', 'Gentle Shell'])
    fireEvent.click(screen.getByText('Gentle Shell'))
    expect(launchAgent).toHaveBeenCalledWith('pi', 'Gentle Shell')
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
  })

  it("keeps the workspace's own agents without a host", () => {
    render(<QuickLaunchAgentMenuItems worktreeId="w" groupId="g" onFocusTerminal={vi.fn()} />)
    expect(agentRows()).toEqual(['Claude', 'OpenCode'])
  })
})
