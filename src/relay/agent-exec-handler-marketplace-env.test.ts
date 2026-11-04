import { spawn } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ChildProcess from 'node:child_process'
import { createFakeChild, createHandlers, requestContext } from './agent-exec-handler-test-harness'
import { buildRelayMarketplaceEnv, relayMarketplaceEnv } from './relay-marketplace-vault'

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcess>()),
  execFile: vi.fn(),
  spawn: vi.fn()
}))

const spawnMock = vi.mocked(spawn)

function spawnedEnv(): Record<string, string | undefined> {
  const options = spawnMock.mock.calls[0]?.[2]
  return options && typeof options === 'object' && 'env' in options ? { ...options.env } : {}
}

async function runAgent(
  marketplaceEnv: () => Record<string, string>,
  env?: Record<string, string>
): Promise<void> {
  const handlers = createHandlers()
  relayMarketplaceEnv.build = marketplaceEnv
  const child = createFakeChild()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake child offers the members exec reads.
  spawnMock.mockReturnValue(child as never)
  const pending = handlers.get('agent.execNonInteractive')!(
    { binary: 'agent', timeoutMs: 5_000, env },
    requestContext()
  )
  child.emit('close', 0)
  await pending
}

describe('AgentExecHandler host vault env', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })
  afterEach(() => {
    relayMarketplaceEnv.build = buildRelayMarketplaceEnv
  })

  it('hands the host own vault tokens to a headless agent', async () => {
    await runAgent(() => ({ OPENMETADATA_TOKEN: 'host-token' }))
    expect(spawnedEnv().OPENMETADATA_TOKEN).toBe('host-token')
  })

  it('lets the caller env win over the vault', async () => {
    await runAgent(() => ({ OPENMETADATA_TOKEN: 'host-token' }), {
      OPENMETADATA_TOKEN: 'caller-token'
    })
    expect(spawnedEnv().OPENMETADATA_TOKEN).toBe('caller-token')
  })

  it('adds nothing when the host vault is empty', async () => {
    await runAgent(() => ({}))
    expect(spawnedEnv().OPENMETADATA_TOKEN).toBeUndefined()
  })
})
