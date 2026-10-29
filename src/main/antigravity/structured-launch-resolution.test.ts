import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  const probeVersion = vi.fn(async () => 'supported' as const)
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

it('launches the model variant for the picked effort', async () => {
  const h = await setup()
  const resolve = createAntigravityLaunchResolver(h.deps)
  const flagValue = (args: readonly string[], flag: string) => args[args.indexOf(flag) + 1]

  const picked = (await resolve(identity, { model: 'gemini-4-argon-medium', effort: 'high' })).args
  expect(flagValue(picked, '--model')).toBe('gemini-4-argon-high')
  expect(flagValue(picked, '--effort')).toBe('high')

  const stored = (await resolve(identity, { model: 'gemini-4-argon-high' })).args
  expect(flagValue(stored, '--model')).toBe('gemini-4-argon-high')
  expect(stored).not.toContain('--effort')
})

it('lists each model once, with its efforts, from the agy listing', async () => {
  const probe = createAntigravityModelCatalogProbe({
    resolveEnvironment: async () => ({ HOME: '/host/home' }),
    readBinding: async () => binding,
    probeVersion: async () => 'supported' as const,
    runListing: vi.fn(
      async () =>
        'gemini-4-argon-medium\tGemini 4 Argon (Medium)\ngemini-4-argon-low\tGemini 4 Argon (Low)\n'
    )
  })
  const listing = await probe(binding)
  expect(listing.models).toEqual([
    expect.objectContaining({
      id: 'gemini-4-argon-medium',
      label: 'Gemini 4 Argon',
      defaultEffort: 'medium',
      efforts: [
        { value: 'low', label: 'low' },
        { value: 'medium', label: 'medium' }
      ]
    })
  ])
})

it('lists bounded account-scoped models with the existing agy parser', async () => {
  const runListing = vi.fn(async () => 'gemini-id\tGemini Example\n')
  const probe = createAntigravityModelCatalogProbe({
    resolveEnvironment: async () => ({ HOME: '/host/home' }),
    readBinding: async () => binding,
    probeVersion: async () => 'supported' as const,
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

it.each([
  ['auto', ['--mode', 'auto']],
  ['accept-edits', ['--mode', 'accept-edits']],
  ['plan', ['--mode', 'plan']]
] as const)('launches the %s preset with %j and never the skip flag', async (mode, flags) => {
  const h = await setup()
  vi.spyOn(h.store, 'getRecord').mockReturnValue({ ...h.record, options: { accessMode: mode } })
  const launch = await createAntigravityLaunchResolver({
    ...h.deps,
    resolveFullAccess: () => true
  })(identity)
  expect(launch.args.slice(-2)).toEqual(flags)
  expect(launch.args).not.toContain('--dangerously-skip-permissions')
})

it('adds no mode flag for Ask for approval', async () => {
  const h = await setup()
  vi.spyOn(h.store, 'getRecord').mockReturnValue({
    ...h.record,
    options: { accessMode: 'default' }
  })
  const launch = await createAntigravityLaunchResolver(h.deps)(identity)
  expect(launch.args).not.toContain('--mode')
})

it.each([
  ['did-not-start', 'cliMissing'],
  ['unsupported', 'antigravityCliVersionUnsupported']
] as const)(
  'refuses a launch whose agy CLI is %s with the %s reason, before anything spawns',
  async (outcome, reason) => {
    const h = await setup()
    await expect(
      createAntigravityLaunchResolver({ ...h.deps, probeVersion: async () => outcome })(identity)
    ).rejects.toMatchObject({ name: 'AgentSessionPreSpawnError', reason })
  }
)

describe('saved Arguments', () => {
  it('passes user options through ahead of Orca-owned ones and drops what Orca owns', async () => {
    const h = await setup()
    const launch = await createAntigravityLaunchResolver({
      ...h.deps,
      resolveLaunchArgs: () => [
        '--dangerously-skip-permissions',
        '--mode',
        'plan',
        '--output-format',
        'text',
        '--add-dir',
        '/extra'
      ]
    })(identity)
    expect(launch.args).toEqual([
      '--add-dir',
      '/extra',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json'
    ])
  })

  it('lets the chat model beat a saved model but keeps a saved model otherwise', async () => {
    const h = await setup()
    const resolve = createAntigravityLaunchResolver({
      ...h.deps,
      resolveLaunchArgs: () => ['--model', 'saved']
    })
    expect((await resolve(identity)).args).toContain('saved')
    const picked = (await resolve(identity, { model: 'chosen' })).args
    expect(picked).not.toContain('saved')
    expect(picked).toContain('chosen')
  })

  it('refuses a positional prompt with a typed Arguments problem', async () => {
    const h = await setup()
    const rejection = createAntigravityLaunchResolver({
      ...h.deps,
      resolveLaunchArgs: () => ['do the thing']
    })(identity)
    await expect(rejection).rejects.toMatchObject({
      argumentProblem: { agent: 'Antigravity', option: 'prompt', problem: 'positionalPrompt' }
    })
  })
})

it('hands agy the child-session instructions folder and the Orca CLI identity when delegation can run', async () => {
  const h = await setup()
  const launch = await createAntigravityLaunchResolver({
    ...h.deps,
    resolveDelegationInstructionsFolder: async () => '/state/delegation-instructions'
  })(identity)
  expect(launch.args.slice(-2)).toEqual(['--add-dir', '/state/delegation-instructions'])
  expect(launch.env).toMatchObject({
    ORCA_AGENT_SESSION_ID: identity.sessionId,
    ORCA_STRUCTURED_SESSION: '1'
  })
  expect(launch.env?.ORCA_CLI_COMMAND).toBeTruthy()
})

it('adds no instructions folder when none is available', async () => {
  const h = await setup()
  const unavailable = await createAntigravityLaunchResolver({
    ...h.deps,
    resolveDelegationInstructionsFolder: async () => null
  })(identity)
  const unwired = await createAntigravityLaunchResolver(h.deps)(identity)
  expect(unavailable.args).not.toContain('--add-dir')
  expect(unwired.args).not.toContain('--add-dir')
})
