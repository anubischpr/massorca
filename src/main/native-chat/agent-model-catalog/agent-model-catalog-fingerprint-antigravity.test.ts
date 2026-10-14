import { describe, expect, it } from 'vitest'
import type { AntigravityAgentSessionAccountHome } from '../../../shared/agent-session-account-home'
import { agentModelCatalogFingerprint } from './agent-model-catalog-fingerprint'

describe('Antigravity account-scoped model catalogs', () => {
  it('separates accounts and credential authorities under the same auth home', () => {
    const accountHome: AntigravityAgentSessionAccountHome = {
      kind: 'antigravity',
      locator: {
        home: '/host/home',
        credentialStore: 'file',
        issuer: 'https://accounts.google.com',
        subject: 'a',
        authMethod: 'consumer'
      }
    }
    const fingerprint = (account: AntigravityAgentSessionAccountHome) =>
      agentModelCatalogFingerprint({ agent: 'antigravity', accountHome: account, wslDistro: null })
    const original = fingerprint(accountHome)
    expect(fingerprint(structuredClone(accountHome))).toBe(original)
    for (const patch of [
      { subject: 'b' },
      { credentialStore: 'macos-keychain' as const },
      { home: '/another' },
      { authMethod: 'enterprise' }
    ]) {
      expect(
        fingerprint({ ...accountHome, locator: { ...accountHome.locator, ...patch } })
      ).not.toBe(original)
    }
  })
})
