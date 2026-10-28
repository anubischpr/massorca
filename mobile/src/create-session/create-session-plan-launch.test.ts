import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import type { RpcClient } from '../transport/rpc-client'
import { launchGentleShellSession } from './create-session-gentle-shell-launch'
import { launchCreateSession } from './create-session-launch'
import {
  launchCreateSessionPlan,
  type CreateSessionPlanLaunchArgs
} from './create-session-plan-launch'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'

vi.mock('./create-session-gentle-shell-launch', () => ({ launchGentleShellSession: vi.fn() }))
vi.mock('./create-session-launch', () => ({ launchCreateSession: vi.fn() }))

const client: RpcClient = {
  sendRequest: vi.fn(),
  subscribe: () => () => {},
  updateTerminalSubscriptionViewport: () => {},
  getState: () => 'connected',
  getReconnectAttempt: () => 0,
  getLastConnectedAt: () => null,
  onStateChange: () => () => {},
  notifyForeground: () => {},
  close: () => {}
}

const repo: MobileWorkspaceRepo = { id: 'web', displayName: 'web', path: '/work/web' }

function argsFor(plan: CreateSessionLaunchPlan): CreateSessionPlanLaunchArgs {
  return {
    client,
    hostId: 'local',
    repo,
    plan,
    setup: { decision: 'inherit', notice: null },
    agentLaunchSupport: Promise.resolve({ replay: true }),
    worktreeCreateIdempotency: Promise.resolve(false)
  }
}

const base: CreateSessionLaunchPlan = {
  kind: 'current-checkout',
  repoId: 'web',
  agent: 'pi',
  prompt: 'go'
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(launchGentleShellSession).mockResolvedValue({ ok: true, worktreeId: 'wt', name: 'web' })
  vi.mocked(launchCreateSession).mockResolvedValue({ ok: true, worktreeId: 'wt', name: 'web' })
})

describe('launchCreateSessionPlan', () => {
  it('starts a Gentle Shell plan through the structured create', async () => {
    const args = argsFor({ ...base, piRuntime: 'gentle-shell' })
    await launchCreateSessionPlan(args)
    expect(launchGentleShellSession).toHaveBeenCalledWith(args)
    expect(launchCreateSession).not.toHaveBeenCalled()
  })

  it('keeps stock Pi and every other agent on agent.launch', async () => {
    await launchCreateSessionPlan(argsFor({ ...base, piRuntime: 'pi' }))
    await launchCreateSessionPlan(argsFor({ ...base, agent: 'claude' }))
    expect(launchCreateSession).toHaveBeenCalledTimes(2)
    expect(launchGentleShellSession).not.toHaveBeenCalled()
  })
})
