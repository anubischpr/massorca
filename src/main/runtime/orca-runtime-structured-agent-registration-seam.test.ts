// createSupport, create and the model catalog's account read ask the runtime's one registration
// list where an agent runs and which account it pins, before any host exists. An agent the list does
// not hold is answered no without installing the host.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OrcaRuntimeService } from './orca-runtime'
import { structuredAgentRuntimeRegistration } from './structured-agent-runtime-registrations'

afterEach(() => vi.restoreAllMocks())

const LOCAL = {
  executionHostId: 'local',
  wslDistro: null,
  workspaceId: 'workspace-1',
  workspaceKind: 'git-worktree' as const
}

function runtimeAt(location = LOCAL, settings: Record<string, unknown> = { agentDefaultEnv: {} }) {
  const runtime = new OrcaRuntimeService(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these reads consume only getSettings from the store.
    { getSettings: () => settings } as never
  )
  const installHost = vi.fn(async () => {
    throw new Error('the host must not be installed to answer this')
  })
  Object.assign(runtime, {
    resolveStructuredAgentSessionLocation: vi.fn(async () => location),
    ensureStructuredAgentSessionHost: installHost
  })
  return { runtime, installHost }
}

describe('the structured agent registration list', () => {
  it("answers createSupport from the agent's own location rule", async () => {
    const codex = structuredAgentRuntimeRegistration('codex')!
    const { runtime, installHost } = runtimeAt()
    expect(await runtime.getStructuredAgentSessionCreateSupport('id:workspace-1', 'codex')).toEqual(
      { supported: true }
    )

    vi.spyOn(codex, 'supportsLocation').mockReturnValue(false)
    expect(await runtime.getStructuredAgentSessionCreateSupport('id:workspace-1', 'codex')).toEqual(
      { supported: false, reason: 'agent' }
    )
    expect(codex.supportsLocation).toHaveBeenCalledWith(LOCAL)
    expect(installHost).not.toHaveBeenCalled()
  })

  it('refuses an agent it does not hold without installing the host', async () => {
    const { runtime, installHost } = runtimeAt()
    // No structured registration exists for Cursor.
    expect(
      await runtime.getStructuredAgentSessionCreateSupport('id:workspace-1', 'cursor')
    ).toEqual({
      supported: false,
      reason: 'agent'
    })
    await expect(runtime.resolveStructuredAgentAccountHome('cursor')).rejects.toMatchObject({
      message: 'structured_agent_session_unsupported'
    })
    expect(installHost).not.toHaveBeenCalled()
  })

  it("resolves an account home through the agent's registration, with the read purpose", async () => {
    const claude = structuredAgentRuntimeRegistration('claude')!
    vi.spyOn(claude, 'resolveAccountHome').mockResolvedValue({
      variable: 'CLAUDE_CONFIG_DIR',
      path: '/accounts/claude'
    })
    const { runtime, installHost } = runtimeAt()

    expect(await runtime.resolveStructuredAgentAccountHome('claude')).toEqual({
      variable: 'CLAUDE_CONFIG_DIR',
      path: '/accounts/claude'
    })
    expect(claude.resolveAccountHome).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'read', location: null, workspacePath: null }),
      expect.anything()
    )
    expect(installHost).not.toHaveBeenCalled()
  })

  it('passes the selected command settings to the account-home registration for catalog reads', async () => {
    const pi = structuredAgentRuntimeRegistration('pi')!
    const commandSettings = { agentCmdOverrides: { pi: 'gentle-shell' } }
    const settings = { agentDefaultEnv: { pi: { PI_CODING_AGENT_DIR: '' } }, ...commandSettings }
    const resolveAccountHome = vi.spyOn(pi, 'resolveAccountHome').mockResolvedValue({
      variable: 'PI_CODING_AGENT_DIR',
      path: '/home/user/.gentle-shell/agent'
    })
    const { runtime } = runtimeAt(LOCAL, settings)

    await runtime.resolveStructuredAgentAccountHome('pi')

    expect(resolveAccountHome.mock.calls[0]?.[0]).toMatchObject({ commandSettings })
  })

  it('selects the Gentle-Shell home through the runtime registration while preserving an override', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-gentle-shell-home-'))
    try {
      const command = join(root, process.platform === 'win32' ? 'gentle-shell.cmd' : 'gentle-shell')
      await writeFile(command, '')
      await chmod(command, 0o755)
      const settings = {
        agentDefaultEnv: { pi: { PATH: root, HOME: '/host/home' } },
        agentCmdOverrides: { pi: command }
      }
      const { runtime } = runtimeAt(LOCAL, settings)

      await expect(runtime.resolveStructuredAgentAccountHome('pi')).resolves.toEqual({
        variable: 'PI_CODING_AGENT_DIR',
        path: join('/host/home', '.gentle-shell', 'agent')
      })

      const override = '/accounts/explicit-pi'
      const explicit = runtimeAt(LOCAL, {
        ...settings,
        agentDefaultEnv: {
          pi: { PATH: root, HOME: '/host/home', PI_CODING_AGENT_DIR: override }
        }
      }).runtime
      await expect(explicit.resolveStructuredAgentAccountHome('pi')).resolves.toEqual({
        variable: 'PI_CODING_AGENT_DIR',
        path: override
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
