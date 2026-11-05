// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

const mocks = vi.hoisted(() => ({ teams: [] as BotTeam[] }))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/components/bot-teams/use-bot-teams', () => ({
  useBotTeams: () => ({ teams: mocks.teams, failed: false })
}))
vi.mock('@/components/bot-teams/BotAgentIcon', () => ({
  BotAgentIcon: ({ agent }: { agent: string }) => <i data-agent={agent} />
}))
vi.mock('@/components/bot-teams/BotTeamCharacterIcon', () => ({
  BotTeamCharacterIcon: ({ character }: { character: string }) => <i data-character={character} />
}))

const { MarketplaceAppAccessBots } = await import('./MarketplaceAppAccessBots')

const team: BotTeam = {
  id: 'team-alpha',
  name: 'Alpha',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [
    {
      id: 'bot-leo',
      name: 'Leo',
      job: '',
      agent: 'pi',
      modelMode: 'auto',
      model: null,
      effort: null,
      skills: []
    }
  ]
}

const roots: Root[] = []

async function render(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(
      <MarketplaceAppAccessBots
        bots={{ mode: 'only', botIds: ['bot-leo'], teamIds: ['team-alpha'] }}
        disabled={false}
        onChange={vi.fn()}
      />
    )
  })
  return container
}

describe('MarketplaceAppAccessBots', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.teams = [team]
  })

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it("shows each picked bot with its agent's icon and each team with its character", async () => {
    const container = await render()
    const chips = [...container.querySelectorAll('li')]
    const teamChip = chips.find((chip) => chip.textContent?.includes('Alpha'))
    const botChip = chips.find((chip) => chip.textContent?.includes('Leo'))
    expect(teamChip?.querySelector('[data-character="square"]')).not.toBeNull()
    expect(botChip?.querySelector('[data-agent="pi"]')).not.toBeNull()
  })

  it('shows the same icons in the picker', async () => {
    const container = await render()
    const trigger = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Add a bot or team')
    )
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      trigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    const items = [...document.querySelectorAll('[cmdk-item]')]
    const leo = items.find((item) => item.textContent?.includes('Leo'))
    const wholeTeam = items.find((item) => item.textContent?.includes('Whole team'))
    expect(leo?.querySelector('[data-agent="pi"]')).not.toBeNull()
    expect(wholeTeam?.querySelector('[data-character="square"]')).not.toBeNull()
  })
})
