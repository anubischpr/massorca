import { describe, expect, it, vi } from 'vitest'
import { marketplaceAgentSwitchBlockedMessage } from '../../../../shared/marketplace-apps'

const translate = vi.hoisted(() =>
  vi.fn(
    (key: string, fallback: string, options?: { items?: string }) =>
      `${key}|${fallback.replace('{{items}}', options?.items ?? '')}`
  )
)
vi.mock('@/i18n/i18n', () => ({ translate }))

import { botTeamChangeErrorText } from './bot-team-change-error-text'

describe('a failed bot-team change', () => {
  it('shows the Antigravity refusal through the shared translation key, with its items', () => {
    const host = marketplaceAgentSwitchBlockedMessage(['Engram', 'OpenMetadata'])
    expect(botTeamChangeErrorText(`Error invoking remote method: ${host}`)).toBe(
      `auto.shared.marketplace-apps.agentSwitchBlocked|${host}`
    )
    expect(translate).toHaveBeenCalledWith(
      'auto.shared.marketplace-apps.agentSwitchBlocked',
      expect.any(String),
      { items: 'Engram, OpenMetadata' }
    )
  })

  it('shows any other error as the host wrote it', () => {
    expect(botTeamChangeErrorText('Bot bob is not on team t1.')).toBe('Bot bob is not on team t1.')
  })
})
