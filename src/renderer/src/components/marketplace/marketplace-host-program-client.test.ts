import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: rpc.call }))

const { agentHostProgram, readHostProgramStatus, runHostProgramAction } =
  await import('./marketplace-host-program-client')

beforeEach(() => {
  rpc.call.mockReset()
})

describe('agentHostProgram', () => {
  it('maps the agents MassOrca installs, with Pi on the Marketplace being Gentle Shell', () => {
    expect(agentHostProgram('claude')).toBe('claude')
    expect(agentHostProgram('codex')).toBe('codex')
    expect(agentHostProgram('antigravity')).toBe('antigravity')
    expect(agentHostProgram('pi')).toBe('gentle-shell')
  })

  it('leaves every other agent without an install', () => {
    expect(agentHostProgram('gemini')).toBeNull()
    expect(agentHostProgram('opencode')).toBeNull()
  })
})

describe('host program calls', () => {
  it('sends the program and host key to this computer, which routes it', async () => {
    rpc.call.mockResolvedValue({ ok: true, version: 'git 2' })
    await expect(runHostProgramAction('install', 'git', 'ssh:box')).resolves.toEqual({
      ok: true,
      version: 'git 2'
    })
    expect(rpc.call).toHaveBeenCalledWith({ kind: 'local' }, 'marketplace.program.install', {
      program: 'git',
      host: 'ssh:box'
    })
    await runHostProgramAction('uninstall', 'node', 'local')
    expect(rpc.call).toHaveBeenLastCalledWith({ kind: 'local' }, 'marketplace.program.uninstall', {
      program: 'node',
      host: 'local'
    })
    await runHostProgramAction('reinstall', 'codex', 'local')
    expect(rpc.call).toHaveBeenLastCalledWith({ kind: 'local' }, 'marketplace.program.reinstall', {
      program: 'codex',
      host: 'local'
    })
    await readHostProgramStatus('gh', 'wsl:Ubuntu')
    expect(rpc.call).toHaveBeenLastCalledWith({ kind: 'local' }, 'marketplace.program.status', {
      program: 'gh',
      host: 'wsl:Ubuntu'
    })
  })

  it('reads an answer from its known fields only', async () => {
    rpc.call.mockResolvedValue({
      ok: false,
      reason: 'needs-admin',
      command: 'sudo x',
      secret: 'no'
    })
    await expect(runHostProgramAction('install', 'git', 'local')).resolves.toEqual({
      ok: false,
      reason: 'needs-admin',
      command: 'sudo x'
    })
    rpc.call.mockResolvedValue('nonsense')
    await expect(readHostProgramStatus('git', 'local')).resolves.toEqual({
      ok: false,
      reason: 'failed'
    })
  })

  it('tells the person to update a host that predates the methods', async () => {
    rpc.call.mockRejectedValue(Object.assign(new Error('x'), { code: 'method_not_found' }))
    await expect(runHostProgramAction('install', 'git', 'local')).resolves.toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
  })

  it('reports any other thrown error as a failure without repeating its text', async () => {
    rpc.call.mockRejectedValue(new Error('token=abc'))
    await expect(readHostProgramStatus('git', 'local')).resolves.toEqual({
      ok: false,
      reason: 'failed'
    })
  })
})
