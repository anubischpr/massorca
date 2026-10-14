import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { openTestAgentSessionRecordStore } from '../runtime/agent-session-record-store-test-harness'
import { closeTestJournalHostDatabase } from '../native-chat/agent-session-journal/journal-host-database-test-support'
import {
  createAntigravityLaunchResolver,
  antigravityProviderLink
} from './structured-launch-resolution'
import { createAntigravityModelCatalogProbe } from './model-catalog-probe'
import type { AntigravityAgentSessionAccountHome } from '../../shared/agent-session-account-home'

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
  sessionId: 'antigravity-launch',
  workspaceId: 'folder',
  hostId: 'local',
  agent: 'antigravity',
  providerHandle: null
} as const
const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) {
    closeTestJournalHostDatabase(root)
    await rm(root, { recursive: true, force: true })
  }
})

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'orca-antigravity-launch-'))
  roots.push(root)
  const store = await openTestAgentSessionRecordStore(root)
  const { record } = await store.reserveOwner({
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
  const readBinding = vi.fn(async () => binding)
  const prepareAccount = vi.fn(async () => {})
  const probeVersion = vi.fn(async () => true)
  const deps = {
    store,
    resolveWorkspacePath: async () => '/host/workspace',
    resolveEnvironment: async () => ({ HOME: '/host/home' }),
    readBinding,
    prepareAccount,
    probeVersion
  }
  return { store, record, deps, readBinding, prepareAccount }
}

it('uses paired stream formats and acquisition-only options, retaining soft denial by default', async () => {
  const h = await setup()
  const launch = await createAntigravityLaunchResolver(h.deps)(identity, {
    model: 'model-id',
    effort: 'medium'
  })
  expect(launch.args).toEqual([
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--model',
    'model-id',
    '--effort',
    'medium'
  ])
  expect(h.readBinding).toHaveBeenCalledWith({
    launchEnv: { HOME: '/host/home' },
    previous: binding
  })
  expect(h.prepareAccount).toHaveBeenCalledOnce()
  const full = await createAntigravityLaunchResolver({ ...h.deps, resolveFullAccess: () => true })(
    identity
  )
  expect(full.args).toContain('--dangerously-skip-permissions')
})

it('resumes only the pinned conversation and rejects a changed init identity', async () => {
  const h = await setup()
  const prior = antigravityProviderLink({ command: 'agy', args: [], previous: null }, 'exact-id', 1)
  vi.spyOn(h.store, 'getRecord').mockReturnValue({ ...h.record, providerHandleChain: [prior] })
  const launch = await createAntigravityLaunchResolver(h.deps)(identity)
  expect(launch.args).toContain('--conversation')
  expect(launch.args).toContain('exact-id')
  expect(launch.args).not.toContain('--continue')
  expect(antigravityProviderLink(launch, 'exact-id', 2).origin).toBe('resumed')
  expect(() => antigravityProviderLink(launch, 'other-id', 2)).toThrow('different conversation')
})

it('refuses unknown account authority before probing or launching', async () => {
  const h = await setup()
  h.readBinding.mockRejectedValue(new Error('unknown credential authority'))
  await expect(createAntigravityLaunchResolver(h.deps)(identity)).rejects.toThrow(
    'unknown credential authority'
  )
  expect(h.deps.probeVersion).not.toHaveBeenCalled()
})

it('lists bounded account-scoped models with the existing agy parser', async () => {
  const runListing = vi.fn(async () => 'gemini-id\tGemini Example\n')
  const probe = createAntigravityModelCatalogProbe({
    resolveEnvironment: async () => ({ HOME: '/host/home' }),
    readBinding: async () => binding,
    probeVersion: async () => true,
    runListing
  })
  const listing = await probe(binding)
  expect(listing.models[0]).toMatchObject({
    id: 'gemini-id',
    label: 'Gemini Example',
    isDefault: false
  })
  expect(runListing).toHaveBeenCalledWith(
    expect.objectContaining({ args: ['models'] }),
    expect.objectContaining({ site: 'antigravity-model-catalog' })
  )
})

it.each([
  ['inherit', false, false],
  ['inherit', true, true],
  ['default', false, false],
  ['default', true, false],
  ['full-access', false, true],
  ['full-access', true, true]
] as const)(
  'maps Antigravity session access %s with inherited %s to full access %s',
  async (mode, inherited, full) => {
    const h = await setup()
    const options = { accessMode: mode }
    vi.spyOn(h.store, 'getRecord').mockReturnValue({ ...h.record, options })
    const launch = await createAntigravityLaunchResolver({
      ...h.deps,
      resolveFullAccess: () => inherited
    })(identity)
    expect(launch.args.includes('--dangerously-skip-permissions')).toBe(full)
    expect(options).toEqual({ accessMode: mode })
  }
)
