import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeTestJournalHostDatabase } from '../native-chat/agent-session-journal/journal-host-database-test-support'
import { openTestAgentSessionRecordStore } from '../runtime/agent-session-record-store-test-harness'
import { MarketplaceVault, emptyMarketplaceState } from '../marketplace/marketplace-vault'
import type { BotRunDenial } from '../marketplace/marketplace-bot-run-denial'
import { createAntigravityLaunchResolver } from './structured-launch-resolution'
import type { AntigravityAgentSessionAccountHome } from '../../shared/agent-session-account-home'

const vaultUnderTest = vi.hoisted((): { current: unknown } => ({ current: null }))
vi.mock('../marketplace/marketplace-vault', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getMarketplaceVault: () => vaultUnderTest.current
}))

const PROFILE_ENV = 'OPENMETADATA_TOKEN_ESCRITURA'
// Why: fake values only; no assertion prints a credential.
const PROFILE_TOKEN = 'fake-escritura-token-value'

const binding: AntigravityAgentSessionAccountHome = {
  kind: 'antigravity',
  locator: {
    home: '/host/home',
    credentialStore: 'file',
    issuer: 'https://accounts.google.com',
    subject: 'google-subject',
    authMethod: 'consumer'
  }
}
const identity = {
  sessionId: 'antigravity-marketplace',
  workspaceId: 'folder',
  hostId: 'local',
  agent: 'antigravity',
  providerHandle: null
} as const

let root: string
let vault: MarketplaceVault
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-antigravity-marketplace-'))
  vault = new MarketplaceVault(join(root, 'marketplace'), { sealer: () => null })
  vaultUnderTest.current = vault
})
afterEach(async () => {
  closeTestJournalHostDatabase(root)
  await rm(root, { recursive: true, force: true, maxRetries: 3 })
})

function connectProfile(): void {
  vault.writeToken({ kind: 'openmetadata-profile', name: 'escritura' }, PROFILE_TOKEN)
  const state = emptyMarketplaceState()
  state.openMetadata.profiles = [{ name: 'escritura', url: 'https://escritura.example.test' }]
  vault.writeState(state)
}

async function resolve(resolveBotRunDenial?: () => Promise<BotRunDenial | null>) {
  const store = await openTestAgentSessionRecordStore(root)
  await store.reserveOwner({
    sessionId: identity.sessionId,
    location: {
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'folder',
      workspaceKind: 'folder'
    },
    provider: 'antigravity',
    accountHome: binding,
    expectedFence: null,
    spawnToken: 'spawn',
    claimKeyId: 'key',
    handoffOperationId: null,
    probe: { outcome: 'reservation-unused' },
    operation: {
      callerKey: 'client',
      operationId: '1800000000000-00000000000000000000000000000001',
      fingerprint: 'create'
    },
    now: 1_800_000_000_000
  })
  return createAntigravityLaunchResolver({
    ...(resolveBotRunDenial ? { resolveBotRunDenial } : {}),
    store,
    resolveWorkspacePath: async () => '/host/workspace',
    resolveEnvironment: async () => ({ HOME: '/host/home' }),
    readBinding: vi.fn(async () => binding),
    prepareAccount: vi.fn(async () => {}),
    probeVersion: vi.fn(async (_input, supports) => {
      supports('1.4.9')
      return 'supported' as const
    })
  })(identity)
}

describe('Antigravity structured launch marketplace env', () => {
  it('keeps the Marketplace tokens of a denied app out of a bot run', async () => {
    connectProfile()
    const launch = await resolve(async () => ({
      mcpServers: ['openmetadata', 'escritura'],
      envNames: ['OPENMETADATA_TOKEN', PROFILE_ENV],
      envPrefixes: []
    }))
    expect(launch.env).not.toHaveProperty(PROFILE_ENV)
    expect(launch.env).not.toHaveProperty('OPENMETADATA_TOKEN')
    expect(launch.env?.HOME).toBe('/host/home')
  })

  it('gives the chat every connected profile token under its own name', async () => {
    connectProfile()
    const launch = await resolve()
    expect(launch.env?.[PROFILE_ENV]).toBe(PROFILE_TOKEN)
    expect(launch.env?.HOME).toBe('/host/home')
  })

  it('adds nothing when no app is connected', async () => {
    const launch = await resolve()
    expect(launch.env).not.toHaveProperty(PROFILE_ENV)
  })
})
