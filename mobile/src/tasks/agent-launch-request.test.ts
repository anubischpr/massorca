import { describe, expect, it } from 'vitest'
import {
  agentLaunchCreateParams,
  agentLaunchExistingParams,
  isAgentLaunchUnsupportedRefusal,
  readAgentLaunchCreateOutcome,
  readAgentLaunchSupport,
  readLaunchSurface
} from './agent-launch-request'

describe('agentLaunchCreateParams', () => {
  it('carries the create payload verbatim minus the reserved agent fields', () => {
    // Why: the launch owns placement. A `startupAgent` left in the payload would create the
    // worktree agent-first again, which is exactly the path this method exists to replace.
    expect(
      agentLaunchCreateParams('codex', {
        repo: 'id:repo-1',
        name: 'otter',
        setupDecision: 'run',
        comment: 'spike',
        clientMutationId: 'k-1',
        startupAgent: 'codex',
        startupDraft: 'https://example.test/issues/1',
        createdWithAgent: 'codex'
      })
    ).toEqual({
      agent: 'codex',
      target: {
        kind: 'create-worktree',
        create: {
          repo: 'id:repo-1',
          name: 'otter',
          setupDecision: 'run',
          comment: 'spike',
          clientMutationId: 'k-1',
          createdWithAgent: 'codex'
        }
      }
    })
  })
})

describe('agent launch first message and options', () => {
  it('sends the first message and the seeded options with a create', () => {
    const params = agentLaunchCreateParams(
      'claude',
      { repo: 'id:repo-1', name: 'otter', setupDecision: 'inherit' },
      null,
      {
        prompt: { text: 'fix it', delivery: 'submit' },
        sessionOptions: { model: 'opus', accessMode: 'plan' }
      }
    )
    expect(params.prompt).toEqual({ text: 'fix it', delivery: 'submit' })
    expect(params.sessionOptions).toEqual({ model: 'opus', accessMode: 'plan' })
  })

  it('adds neither field when there is nothing to carry', () => {
    const params = agentLaunchCreateParams('claude', { repo: 'id:repo-1', name: 'otter' })
    expect(params).not.toHaveProperty('prompt')
    expect(params).not.toHaveProperty('sessionOptions')
  })

  it('seeds options into a launch in an existing workspace', () => {
    const params = agentLaunchExistingParams({
      agent: 'codex',
      worktreeId: 'wt-1',
      operationId: 'op-1',
      prompt: { text: 'go', delivery: 'submit' },
      sessionOptions: { effort: 'high' }
    })
    expect(params.sessionOptions).toEqual({ effort: 'high' })
    expect(params.target).toEqual({ kind: 'existing', worktree: 'id:wt-1' })
  })

  it.each([
    ['journaled', true],
    ['handed-to-terminal', true],
    ['not-delivered', false]
  ])('reads a %s receipt as delivered=%s', (outcome, delivered) => {
    expect(
      readAgentLaunchCreateOutcome({
        worktreeId: 'wt-1',
        prompt: {
          delivery: 'submit',
          outcome,
          ...(outcome === 'journaled' ? { messageId: 'm' } : {})
        }
      })
    ).toEqual({ worktreeId: 'wt-1', promptDelivered: delivered })
  })

  it('leaves delivery unstated when the host sends no receipt', () => {
    expect(readAgentLaunchCreateOutcome({ worktreeId: 'wt-1' })).toEqual({ worktreeId: 'wt-1' })
  })
})

describe('chat preference and launch surface', () => {
  it('sends the chat preference with a create and with an existing launch', () => {
    const created = agentLaunchCreateParams('codex', { repo: 'id:r', name: 'otter' }, null, {
      preferredMode: 'chat'
    })
    expect(created.preferredMode).toBe('chat')
    const existing = agentLaunchExistingParams({
      agent: 'codex',
      worktreeId: 'wt-1',
      operationId: 'op-1',
      preferredMode: 'chat'
    })
    expect(existing.preferredMode).toBe('chat')
    expect(agentLaunchCreateParams('codex', { repo: 'id:r', name: 'otter' })).not.toHaveProperty(
      'preferredMode'
    )
  })

  it('reads whether the host advertises the preference', () => {
    expect(readAgentLaunchSupport(['agent.launch.v2'])).toMatchObject({ preferredMode: false })
    expect(
      readAgentLaunchSupport(['agent.launch.v2', 'agent.launch.preferred-mode.v1'])
    ).toMatchObject({ preferredMode: true })
    expect(readAgentLaunchSupport([])).toBe(false)
  })

  it('reads the surface the host built from the receipt', () => {
    expect(
      readLaunchSurface({
        receipt: { mode: 'terminal', preferred: 'terminal', reason: 'user_default', detail: 'Why.' }
      })
    ).toEqual({ mode: 'terminal', detail: 'Why.' })
    expect(readLaunchSurface({ receipt: { mode: 'weird' } })).toBeUndefined()
    expect(readLaunchSurface({})).toBeUndefined()
  })
})

describe('readAgentLaunchCreateOutcome', () => {
  it.each([
    {
      label: 'structured',
      result: {
        worktreeId: 'wt-1',
        outcome: { kind: 'structured', sessionId: 's-1', handle: 'agent-session:s-1' }
      }
    },
    {
      label: 'terminal',
      result: { worktreeId: 'wt-1', outcome: { kind: 'terminal', handle: 'term-1' } }
    }
  ])('reads the created workspace out of a $label receipt', ({ result }) => {
    expect(readAgentLaunchCreateOutcome(result)).toEqual({ worktreeId: 'wt-1' })
  })

  it.each([null, 'wt-1', {}, { worktreeId: '' }, { worktreeId: 7 }])(
    'refuses a receipt with no workspace (%j)',
    (result) => {
      expect(readAgentLaunchCreateOutcome(result)).toBeNull()
    }
  )

  it('carries the launch warning, so a workspace that is incomplete says why', () => {
    // A launch can seat the workspace and still fail to finish it — an unspawned pty, untracked
    // files left behind. Dropping the reason is what leaves the phone on a workspace that is
    // quietly wrong. The host reports it at the top level, the same place worktree.create does.
    expect(
      readAgentLaunchCreateOutcome({
        worktreeId: 'wt-1',
        outcome: { kind: 'structured', sessionId: 's-1', handle: 'agent-session:s-1' },
        warning: 'No pty available'
      })
    ).toEqual({ worktreeId: 'wt-1', warning: 'No pty available' })
  })

  it.each([
    { label: 'blank', warning: '   ' },
    { label: 'absent', warning: undefined },
    { label: 'non-string', warning: 7 }
  ])('reports no warning when it is $label', ({ warning }) => {
    expect(
      readAgentLaunchCreateOutcome({
        worktreeId: 'wt-1',
        outcome: { kind: 'terminal', handle: 'term-1' },
        warning
      })
    ).toEqual({ worktreeId: 'wt-1' })
  })

  it('ignores a warning outside the v2 top-level result contract', () => {
    expect(
      readAgentLaunchCreateOutcome({
        worktreeId: 'wt-1',
        outcome: { kind: 'terminal', handle: 'term-1', warning: 'stale nested warning' }
      })
    ).toEqual({ worktreeId: 'wt-1' })
  })
})

describe('isAgentLaunchUnsupportedRefusal', () => {
  it.each([
    { code: 'method_not_found', message: 'Unknown method: agent.launch' },
    { code: 'forbidden', message: "Method 'agent.launch' is not available to mobile clients" },
    { code: 'internal_error', message: 'agent_launch_unsupported' }
  ])('treats $code as a reason to fall back to worktree.create', (error) => {
    expect(isAgentLaunchUnsupportedRefusal(error)).toBe(true)
  })

  it.each([
    { code: 'x', message: 'Branch "otter" already exists locally.' },
    { code: 'x', message: 'SSH connection is not available' },
    {}
  ])('leaves a create failure alone (%j)', (error) => {
    expect(isAgentLaunchUnsupportedRefusal(error)).toBe(false)
  })
})
