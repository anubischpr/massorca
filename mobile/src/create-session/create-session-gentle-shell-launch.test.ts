import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import {
  canStartMobileStructuredAgentSession,
  startMobileStructuredAgentSession
} from '../session/mobile-structured-agent-session-launch'
import { sendMobileStructuredAgentSessionMessage } from '../session/mobile-structured-agent-session-send'
import { markRpcDeliveryUnknown } from '../transport/rpc-delivery-ambiguity'
import type { RpcClient } from '../transport/rpc-client'
import { createWorktreeWithNameRetry } from '../tasks/worktree-create-retry'
import {
  CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE,
  readCreatureName,
  readPrimaryWorkspaceId
} from './create-session-launch'
import {
  GENTLE_SHELL_UNAVAILABLE_MESSAGE,
  GENTLE_SHELL_UNCONFIRMED_MESSAGE,
  launchGentleShellSession
} from './create-session-gentle-shell-launch'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'

vi.mock('../session/mobile-structured-agent-session-launch', () => ({
  canStartMobileStructuredAgentSession: vi.fn(),
  startMobileStructuredAgentSession: vi.fn()
}))
vi.mock('../session/mobile-structured-agent-session-send', () => ({
  sendMobileStructuredAgentSessionMessage: vi.fn()
}))
vi.mock('../tasks/worktree-create-retry', () => ({ createWorktreeWithNameRetry: vi.fn() }))
vi.mock('./create-session-launch', () => ({
  CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE: 'The first message was not confirmed.',
  readCreatureName: vi.fn(),
  readPrimaryWorkspaceId: vi.fn()
}))

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
const currentCheckout: CreateSessionLaunchPlan = {
  kind: 'current-checkout',
  repoId: 'web',
  agent: 'pi',
  piRuntime: 'gentle-shell',
  prompt: 'fix the login bug',
  sessionOptions: { accessMode: 'full-access' }
}
const newWorktree: CreateSessionLaunchPlan = { ...currentCheckout, kind: 'new-worktree' }

function run(plan: CreateSessionLaunchPlan) {
  return launchGentleShellSession({
    client,
    hostId: 'local',
    repo,
    plan,
    setup: { decision: 'inherit', notice: null },
    worktreeCreateIdempotency: Promise.resolve(false)
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(readPrimaryWorkspaceId).mockResolvedValue('wt-main')
  vi.mocked(readCreatureName).mockResolvedValue('calm-otter')
  vi.mocked(canStartMobileStructuredAgentSession).mockResolvedValue(true)
  vi.mocked(startMobileStructuredAgentSession).mockResolvedValue({
    kind: 'created',
    sessionId: 'pi_1',
    fence: 3
  })
  vi.mocked(sendMobileStructuredAgentSessionMessage).mockResolvedValue('accepted')
  vi.mocked(createWorktreeWithNameRetry).mockResolvedValue({
    worktreeId: 'wt-new',
    name: 'calm-otter'
  })
})

describe('launchGentleShellSession', () => {
  it('starts the chat in the current checkout with the picked access mode, then sends the message', async () => {
    await expect(run(currentCheckout)).resolves.toEqual({
      ok: true,
      worktreeId: 'wt-main',
      name: 'web'
    })
    expect(canStartMobileStructuredAgentSession).toHaveBeenCalledWith(client, 'wt-main', 'pi', {
      piRuntime: 'gentle-shell'
    })
    expect(startMobileStructuredAgentSession).toHaveBeenCalledWith(client, 'wt-main', 'pi', {
      piRuntime: 'gentle-shell',
      accessMode: 'full-access'
    })
    expect(sendMobileStructuredAgentSessionMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'pi_1',
        expectedRuntimeFence: 3,
        text: 'fix the login bug',
        attachments: []
      })
    )
    expect(createWorktreeWithNameRetry).not.toHaveBeenCalled()
  })

  it('creates nothing when Gentle Shell cannot start a chat here', async () => {
    vi.mocked(canStartMobileStructuredAgentSession).mockResolvedValue(false)
    await expect(run(newWorktree)).resolves.toEqual({
      ok: false,
      message: GENTLE_SHELL_UNAVAILABLE_MESSAGE
    })
    expect(createWorktreeWithNameRetry).not.toHaveBeenCalled()
    expect(startMobileStructuredAgentSession).not.toHaveBeenCalled()
  })

  it('creates the worktree without an agent, then the chat in it', async () => {
    await expect(run(newWorktree)).resolves.toEqual({
      ok: true,
      worktreeId: 'wt-new',
      name: 'calm-otter'
    })
    const [worktreeParams] = vi.mocked(createWorktreeWithNameRetry).mock.calls[0] ?? []
    expect(worktreeParams).not.toHaveProperty('agentLaunch')
    expect(startMobileStructuredAgentSession).toHaveBeenCalledWith(
      client,
      'wt-new',
      'pi',
      expect.objectContaining({ piRuntime: 'gentle-shell' })
    )
  })

  it('keeps the workspace and warns when the host does not confirm the message', async () => {
    vi.mocked(sendMobileStructuredAgentSessionMessage).mockResolvedValue('rejected')
    await expect(run(currentCheckout)).resolves.toEqual({
      ok: true,
      worktreeId: 'wt-main',
      name: 'web',
      warning: CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE
    })
  })

  it('reports a chat without a runtime fence as unconfirmed, and sends nothing', async () => {
    vi.mocked(startMobileStructuredAgentSession).mockResolvedValue({
      kind: 'created',
      sessionId: 'pi_1',
      fence: null
    })
    await expect(run(currentCheckout)).resolves.toEqual({
      ok: false,
      message: GENTLE_SHELL_UNCONFIRMED_MESSAGE
    })
    expect(sendMobileStructuredAgentSessionMessage).not.toHaveBeenCalled()
  })

  it('makes one create attempt and says the workspace was created when it stays unconfirmed', async () => {
    vi.mocked(startMobileStructuredAgentSession).mockResolvedValue({
      kind: 'unknown',
      message: 'lost'
    })
    await expect(run(newWorktree)).resolves.toEqual({
      ok: false,
      message: `${GENTLE_SHELL_UNCONFIRMED_MESSAGE} The workspace was created.`
    })
    expect(startMobileStructuredAgentSession).toHaveBeenCalledTimes(1)
    expect(sendMobileStructuredAgentSessionMessage).not.toHaveBeenCalled()
  })

  it('shows the host refusal for a definitive failure in the current checkout', async () => {
    vi.mocked(startMobileStructuredAgentSession).mockResolvedValue({
      kind: 'failed',
      message: 'Gentle Shell is busy.'
    })
    await expect(run(currentCheckout)).resolves.toEqual({
      ok: false,
      message: 'Gentle Shell is busy.'
    })
  })

  it('says the create may have happened when its delivery was lost', async () => {
    vi.mocked(createWorktreeWithNameRetry).mockRejectedValue(
      markRpcDeliveryUnknown(new Error('socket closed'))
    )
    await expect(run(newWorktree)).resolves.toEqual({
      ok: false,
      message: GENTLE_SHELL_UNCONFIRMED_MESSAGE
    })
  })
})
