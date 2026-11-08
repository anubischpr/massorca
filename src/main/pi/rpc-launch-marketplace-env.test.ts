import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import { closeTestJournalHostDatabase } from '../native-chat/agent-session-journal/journal-host-database-test-support'
import { openTestAgentSessionRecordStore } from '../runtime/agent-session-record-store-test-harness'
import { MarketplaceVault, emptyMarketplaceState } from '../marketplace/marketplace-vault'
import type { BotRunDenial } from '../marketplace/marketplace-bot-run-denial'
import { createPiRpcLaunchResolver } from './rpc-launch-resolution'
import { buildPiRpcLaunch } from './rpc-launch'

const vaultUnderTest = vi.hoisted((): { current: unknown } => ({ current: null }))
vi.mock('../marketplace/marketplace-vault', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getMarketplaceVault: () => vaultUnderTest.current
}))

const PROFILE_ENV = 'OPENMETADATA_TOKEN_ESCRITURA'
// Why: fake values only; no assertion prints a credential.
const PROFILE_TOKEN = 'fake-escritura-token-value'

const identity: AgentSessionJournalIdentity = {
  sessionId: 'session-pi-marketplace',
  workspaceId: 'folder-1',
  hostId: 'local',
  agent: 'pi',
  providerHandle: null
}

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-pi-marketplace-'))
  const vault = new MarketplaceVault(join(root, 'marketplace'), { sealer: () => null })
  vault.writeToken({ kind: 'openmetadata-profile', name: 'escritura' }, PROFILE_TOKEN)
  const state = emptyMarketplaceState()
  state.openMetadata.profiles = [{ name: 'escritura', url: 'https://escritura.example.test' }]
  vault.writeState(state)
  vaultUnderTest.current = vault
})
afterEach(async () => {
  closeTestJournalHostDatabase(root)
  await rm(root, { recursive: true, force: true, maxRetries: 3 })
})

async function installGentleShellStub(): Promise<void> {
  const command = join(root, process.platform === 'win32' ? 'gentle-shell.cmd' : 'gentle-shell')
  await writeFile(
    command,
    process.platform === 'win32'
      ? '@echo off\r\necho gentle-shell version 4.1.0\r\necho pi version 1.1.0\r\n'
      : '#!/bin/sh\necho gentle-shell version 4.1.0\necho pi version 1.1.0\n'
  )
  if (process.platform !== 'win32') {
    await chmod(command, 0o755)
  }
}

async function resolve(
  piRuntime: 'gentle-shell' | 'pi',
  resolveBotRunDenial?: () => Promise<BotRunDenial | null>
) {
  const store = await openTestAgentSessionRecordStore(root)
  const { record } = await store.reserveOwner({
    sessionId: identity.sessionId,
    location: {
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'folder-1',
      workspaceKind: 'folder'
    },
    provider: 'pi',
    accountHome: { variable: 'PI_CODING_AGENT_DIR', path: '/host/account' },
    expectedFence: null,
    spawnToken: 'spawn-pi',
    claimKeyId: 'key-1',
    handoffOperationId: null,
    probe: { outcome: 'reservation-unused' },
    operation: {
      callerKey: 'client-1',
      operationId: '1800000000000-00000000000000000000000000000001',
      fingerprint: 'pi-create'
    },
    now: 1_800_000_000_000
  })
  vi.spyOn(store, 'getRecord').mockReturnValue({ ...record, options: { piRuntime } })
  const workspace = join(root, 'workspace')
  await mkdir(workspace, { recursive: true })
  return createPiRpcLaunchResolver({
    ...(resolveBotRunDenial ? { resolveBotRunDenial } : {}),
    store,
    resolveWorkspacePath: async () => workspace,
    resolveEnvironment: async () => ({ PATH: root, HOME: '/host/home' }),
    resolveCommandSettings: () => ({ agentCmdOverrides: {} }),
    resolveCommand: () => (piRuntime === 'pi' ? '/host/bin/pi' : join(root, 'gentle-shell')),
    probeVersion: async () => true
  })(identity)
}

describe('Gentle Shell structured launch marketplace env', () => {
  it('keeps the Marketplace tokens of a denied app out of a bot run', async () => {
    await installGentleShellStub()
    const launch = await resolve('gentle-shell', async () => ({
      mcpServers: ['openmetadata', 'escritura'],
      envNames: ['OPENMETADATA_TOKEN', PROFILE_ENV],
      envPrefixes: []
    }))
    expect(launch.env).not.toHaveProperty(PROFILE_ENV)
    expect(launch.env).not.toHaveProperty('OPENMETADATA_TOKEN')
    expect(launch.env?.PI_CODING_AGENT_DIR).toBe('/host/account')
  })

  it('gives the chat every connected profile token under its own name', async () => {
    await installGentleShellStub()
    const launch = await resolve('gentle-shell')
    expect(launch.env?.[PROFILE_ENV]).toBe(PROFILE_TOKEN)
    expect(launch.env?.PI_CODING_AGENT_DIR).toBe('/host/account')
  })

  it('puts the variable in the environment the spawned child gets', async () => {
    await installGentleShellStub()
    const launch = await resolve('gentle-shell')
    const spawned = buildPiRpcLaunch({
      ...launch,
      structuredSession: { id: identity.sessionId, spawnToken: 'spawn-token' }
    })
    expect(spawned.env?.[PROFILE_ENV]).toBe(PROFILE_TOKEN)
  })

  it('adds nothing for stock Pi, which is not a Marketplace agent', async () => {
    const launch = await resolve('pi')
    expect(launch.env).not.toHaveProperty(PROFILE_ENV)
  })
})
