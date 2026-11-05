// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  it('shows the character animations and no per-team access or Marketplace apps rows', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mounted = { root, container }
    act(() => root.render(<BotTeamsSettingsPane />))
    expect(container.textContent).toContain('Character animations')
    expect(container.querySelector('[aria-label="Access"]')).toBeNull()
    expect(
      [...container.querySelectorAll('button')].filter(
        (button) => button.textContent === 'Marketplace apps…'
      )
    ).toHaveLength(0)
  })
})
