/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams: () => Promise.reject(new Error('host unreachable')),
  updateBotOnTeam: vi.fn(),
  updateBotTeam: vi.fn(),
  addBotToTeam: vi.fn(),
  createBotTeam: vi.fn(),
  deleteBotTeam: vi.fn(),
  removeBotFromTeam: vi.fn()
}))
vi.mock('./BotTeamHostPicker', () => ({
  BotTeamHostPicker: () => <div data-testid="host-picker" />,
  BotTeamHostField: () => null
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/agent-catalog', () => ({ AgentIcon: () => null }))
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => new Map() }))
vi.mock('@/components/sidebar/StatusIndicator', () => ({ default: () => null }))

const { default: BotTeamsPage } = await import('./BotTeamsPage')

let mounted: { container: HTMLDivElement; root: Root } | null = null

afterEach(() => {
  if (mounted) {
    const { container, root } = mounted
    act(() => root.unmount())
    container.remove()
    mounted = null
  }
})

describe('a Bot teams host that never answered', () => {
  it('keeps the host picker, so the person can choose a host that answers', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted = { container, root }
    await act(async () => root.render(<BotTeamsPage />))

    expect(container.textContent).toContain('Can’t reach this host.')
    expect(container.querySelector('[data-testid="host-picker"]')).not.toBeNull()
  })
})
