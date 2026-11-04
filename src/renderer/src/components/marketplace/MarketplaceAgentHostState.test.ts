import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

const {
  marketplaceAgentHostActionLabel,
  marketplaceAgentHostKey,
  marketplaceAgentHostLabel,
  marketplaceAgentHostView,
  marketplaceAgentHostsSummary
} = await import('./MarketplaceAgentHostState')

describe('marketplaceAgentHostLabel', () => {
  it('names each host the way the Hosts card does', () => {
    expect(marketplaceAgentHostLabel({ kind: 'local' })).toBe('This computer')
    expect(marketplaceAgentHostLabel({ kind: 'runtime', environmentId: 'e1', label: 'VPS' })).toBe(
      'VPS'
    )
    expect(marketplaceAgentHostLabel({ kind: 'wsl', distro: 'Ubuntu' })).toBe('WSL: Ubuntu')
    expect(marketplaceAgentHostLabel({ kind: 'ssh', connectionId: 'c1', label: 'box' })).toBe(
      'SSH: box'
    )
  })

  it('keys hosts by kind and identity', () => {
    expect(marketplaceAgentHostKey({ kind: 'ssh', connectionId: 'c1', label: 'box' })).toBe(
      'ssh:c1'
    )
    expect(marketplaceAgentHostKey({ kind: 'wsl', distro: 'Ubuntu' })).toBe('wsl:Ubuntu')
  })
})

describe('marketplaceAgentHostView', () => {
  it('shows Found, works with Manage with MassOrca for a found agent', () => {
    const view = marketplaceAgentHostView('found')
    expect(view.badge).toEqual({ label: 'Found, works', tone: 'ok' })
    expect(view.action).toBe('manage')
    expect(marketplaceAgentHostActionLabel('manage')).toBe('Manage with MassOrca')
  })

  it('shows Not installed, Missing and Install for a missing agent', () => {
    const view = marketplaceAgentHostView('missing')
    expect(view.state).toBe('Not installed')
    expect(view.badge).toEqual({ label: 'Missing', tone: 'pending' })
    expect(marketplaceAgentHostActionLabel('install')).toBe('Install')
  })

  it('never calls an unanswered host missing', () => {
    expect(marketplaceAgentHostView('unverifiable')).toEqual({
      state: 'Could not check',
      badge: null,
      action: null
    })
    expect(marketplaceAgentHostView('checking').action).toBeNull()
  })
})

describe('marketplaceAgentHostsSummary', () => {
  it('counts found hosts out of every listed host', () => {
    expect(marketplaceAgentHostsSummary(['found', 'missing', 'found', 'checking'])).toEqual({
      text: 'On 2 of 4 hosts · works on 2',
      tone: 'ok'
    })
    expect(marketplaceAgentHostsSummary(['missing']).tone).toBe('pending')
  })
})
