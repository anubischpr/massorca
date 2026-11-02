import { describe, expect, it } from 'vitest'
import { botTeamWebhookAddress, botTeamWebhookPath } from './bot-team-webhook-path'

describe('a team web address', () => {
  it('names the team in its path, the way the design draws it', () => {
    expect(botTeamWebhookPath('Marketing', 'abc123')).toBe('/hooks/marketing/abc123')
    expect(botTeamWebhookPath('Ventas del Sur!', 'abc123')).toBe('/hooks/ventas-del-sur/abc123')
    expect(botTeamWebhookPath('Atención', 'abc123')).toBe('/hooks/atencion/abc123')
    expect(botTeamWebhookPath('???', 'abc123')).toBe('/hooks/team/abc123')
  })

  it('adds the host only when the host says where it listens', () => {
    expect(botTeamWebhookAddress({ state: 'unavailable' }, 'Marketing', 'abc')).toBe(
      '/hooks/marketing/abc'
    )
    expect(
      botTeamWebhookAddress(
        { state: 'ready', baseUrl: 'https://host.example/' },
        'Marketing',
        'abc'
      )
    ).toBe('https://host.example/hooks/marketing/abc')
  })
})
