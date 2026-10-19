import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from './orca-runtime'

let bin: string
beforeAll(async () => {
  bin = await mkdtemp(join(tmpdir(), 'orca-pi-create-bin-'))
  const file = join(bin, process.platform === 'win32' ? 'gentle-shell.cmd' : 'gentle-shell')
  await writeFile(file, '#!/bin/sh\n')
  await chmod(file, 0o755)
})
afterAll(async () => {
  await rm(bin, { recursive: true, force: true })
})

function piIntentRuntime(support: { supported: boolean; piRuntime?: 'gentle-shell' }) {
  const runtime = new OrcaRuntimeService(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: create intent only reads getSettings from the store.
    { getSettings: () => ({ agentDefaultEnv: { pi: { PATH: bin } } }) } as never,
    undefined,
    {}
  )
  const createSupport = vi
    .spyOn(runtime, 'getStructuredAgentSessionCreateSupport')
    .mockResolvedValue(support)
  Object.assign(runtime, {
    resolveStructuredAgentSessionLocation: vi.fn(async () => ({
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'workspace-1',
      workspaceKind: 'git-worktree' as const
    })),
    resolveRuntimeFileTarget: vi.fn(async () => ({ worktree: { path: '/repos/workspace-1' } }))
  })
  const createIntent = (piRuntime?: 'pi' | 'gentle-shell') =>
    runtime.resolveStructuredAgentSessionCreateIntent({
      envelope: { sessionId: 'pi_session_1', clientOperationId: 'operation-1' },
      worktree: 'id:workspace-1',
      agent: 'pi',
      accessMode: 'full-access',
      ...(piRuntime ? { piRuntime } : {})
    })
  return { createIntent, createSupport }
}

// An older client never sends the runtime, so a host with only Gentle Shell must pick it itself.
describe('structured Pi create when the client names no runtime', () => {
  it('runs on the Gentle Shell the host support check resolved', async () => {
    const { createIntent } = piIntentRuntime({ supported: true, piRuntime: 'gentle-shell' })
    expect((await createIntent()).options).toMatchObject({ piRuntime: 'gentle-shell' })
  })

  it('keeps stock Pi when the host resolved no fallback', async () => {
    const { createIntent } = piIntentRuntime({ supported: true })
    expect((await createIntent()).options).toMatchObject({ piRuntime: 'pi' })
  })

  it('honors an explicit stock Pi over the resolved fallback', async () => {
    const { createIntent } = piIntentRuntime({ supported: true, piRuntime: 'gentle-shell' })
    expect((await createIntent('pi')).options).toMatchObject({ piRuntime: 'pi' })
  })
})
