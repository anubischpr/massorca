import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

const {
  marketplaceAgentHostActionLabel,
  marketplaceAgentHostFromTarget,
  marketplaceAgentHostKey,
  marketplaceAgentHostLabel,
  marketplaceAgentHostStatus,
  marketplaceAgentHostView
} = await import('./MarketplaceAgentHostState')

describe('marketplaceAgentHostLabel', () => {
  it('names each host the way the Hosts card does', () => {
    expect(marketplaceAgentHostLabel({ kind: 'local' })).toBe('This computer')
    expect(marketplaceAgentHostLabel({ kind: 'runtime', environmentId: 'e1', label: 'VPS' })).toBe(
      'VPS'
    )
    expect(marketplaceAgentHostLabel({ kind: 'ssh', connectionId: 'c1', label: 'box' })).toBe(
      'SSH: box'
    )
  })

  it('keys hosts by kind and identity', () => {
    expect(marketplaceAgentHostKey({ kind: 'local' })).toBe('local')
    expect(marketplaceAgentHostKey({ kind: 'runtime', environmentId: 'e1', label: 'VPS' })).toBe(
      'runtime:e1'
    )
    expect(marketplaceAgentHostKey({ kind: 'ssh', connectionId: 'c1', label: 'box' })).toBe(
      'ssh:c1'
    )
  })
})

describe('marketplaceAgentHostFromTarget', () => {
  it('maps the host the shared picker points at, and This computer when none is picked', () => {
    expect(marketplaceAgentHostFromTarget(null)).toEqual({ kind: 'local' })
    expect(
      marketplaceAgentHostFromTarget({ kind: 'runtime', environmentId: 'env-1', label: 'VPS' })
    ).toEqual({ kind: 'runtime', environmentId: 'env-1', label: 'VPS' })
    expect(
      marketplaceAgentHostFromTarget({ kind: 'ssh', connectionId: 'conn-1', label: 'box' })
    ).toEqual({ kind: 'ssh', connectionId: 'conn-1', label: 'box' })
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

describe('marketplaceAgentHostStatus', () => {
  it('names the picked host in the header status, the way the skill page does', () => {
    expect(marketplaceAgentHostStatus('This computer', 'found')).toEqual({
      text: 'Installed on This computer',
      tone: 'ok'
    })
    expect(marketplaceAgentHostStatus('VPS', 'missing')).toEqual({
      text: 'Not installed on VPS',
      tone: 'pending'
    })
    expect(marketplaceAgentHostStatus('VPS', 'checking')).toEqual({
      text: 'Checking VPS…',
      tone: 'pending'
    })
    expect(marketplaceAgentHostStatus('box', 'unverifiable')).toEqual({
      text: 'Could not check box',
      tone: 'pending'
    })
  })
})
