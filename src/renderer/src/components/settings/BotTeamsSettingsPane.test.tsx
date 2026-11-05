// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

const TEAMS = [
  {
    id: 'dev',
    name: 'Desarrollo',
    character: 'square',
    accessMode: 'default',
    workspacesEnabled: true,
    bots: []
  },
  {
    id: 'mk',
    name: 'Marketing',
    character: 'circle',
    accessMode: 'full-access',
    workspacesEnabled: false,
    bots: []
  }
]

vi.mock('@/components/bot-teams/use-bot-teams', () => ({
  useBotTeams: () => ({ teams: TEAMS, applyChange: vi.fn() })
}))
vi.mock('@/components/bot-teams/BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => null }))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) =>
    select({ settings: { botTeamCharacterAnimations: true }, updateSettings: vi.fn() })
}))
vi.mock('./BotTeamsIntegrations', () => ({ BotTeamsIntegrations: () => null }))
vi.mock('@/components/marketplace/MarketplaceTeamAccessDialog', () => ({
  MarketplaceTeamAccessDialog: ({ team }: { team: BotTeam }) => (
    <div data-testid="team-apps-dialog">{team.name}</div>
  )
}))

import { BotTeamsSettingsPane } from './BotTeamsSettingsPane'

let mounted: { root: Root; container: HTMLDivElement } | null = null
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount())
    mounted.container.remove()
    mounted = null
  }
})

describe('Bot teams settings', () => {
  it('opens the Marketplace apps dialog for the team whose button was pressed', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mounted = { root, container }
    act(() => root.render(<BotTeamsSettingsPane />))
    const buttons = [...container.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Marketplace apps…'
    )
    expect(buttons).toHaveLength(2)
    expect(container.querySelector('[data-testid="team-apps-dialog"]')).toBeNull()

    act(() => buttons[1].click())

    expect(container.querySelector('[data-testid="team-apps-dialog"]')?.textContent).toBe(
      'Marketing'
    )
  })
})
