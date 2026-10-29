// A registered agent (Grok) is a structured worker under the same setting as Claude and Codex, when the
// host can create its session. An agent with no structured registration stays a terminal worker.

import { describe, expect, it } from 'vitest'
import { decideAgentLaunchMode } from '../../../agent-launch/agent-launch-mode'
import {
  decideWorkerStartMode,
  resolveWorkerStartModeOnHost
} from './orchestration-worker-start-mode'
import { createStructuredWorkerSessionForWorktree } from './orchestration/worker/worker-topology'

const STRUCTURED_PREFERENCE = {
  experimentalNativeChat: true
} as const

describe('a Grok worker and the structured-chat setting', () => {
  it('starts structured under the setting when the host can create the session', async () => {
    const grok = decideWorkerStartMode({
      params: { agent: 'grok' },
      settings: STRUCTURED_PREFERENCE
    })
    expect(grok).toMatchObject({ mode: 'structured', reason: 'user_default' })
    const host = { getStructuredAgentSessionCreateSupport: async () => ({ supported: true }) }
    expect(await resolveWorkerStartModeOnHost(host, grok, 'wt-1', 'grok')).toMatchObject({
      mode: 'structured'
    })
    expect(
      decideWorkerStartMode({ params: { agent: 'claude' }, settings: STRUCTURED_PREFERENCE })
    ).toMatchObject({ mode: 'structured', reason: 'user_default' })
  })

  it('falls back to a terminal worker when the host refuses the session', async () => {
    const grok = decideWorkerStartMode({
      params: { agent: 'grok' },
      settings: STRUCTURED_PREFERENCE
    })
    const host = {
      getStructuredAgentSessionCreateSupport: async () => ({
        supported: false as const,
        reason: 'agent' as const
      })
    }
    expect(await resolveWorkerStartModeOnHost(host, grok, 'wt-1', 'grok')).toMatchObject({
      mode: 'terminal',
      reason: 'structured_unsupported_on_host'
    })
  })

  it('keeps an agent with no structured registration a terminal worker', () => {
    expect(
      decideWorkerStartMode({ params: { agent: 'cursor' }, settings: STRUCTURED_PREFERENCE })
    ).toMatchObject({ mode: 'terminal', reason: 'agent_without_structured_session' })
  })

  it('still opens Grok as a structured chat for other launches', () => {
    expect(
      decideAgentLaunchMode({ placement: { agent: 'grok' }, settings: STRUCTURED_PREFERENCE })
    ).toMatchObject({ mode: 'structured' })
  })

  it('refuses to build a structured worker for an agent with no registration', async () => {
    await expect(
      createStructuredWorkerSessionForWorktree({
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the factory refuses the agent before it reads the runtime.
        runtime: {} as never,
        worktreeId: 'wt-1',
        agent: 'cursor',
        dispatchId: 'd-1',
        effects: []
      })
    ).rejects.toThrow(/cursor has no structured session on this host/)
  })

  it('starts as a terminal agent while the setting is off, as Claude does', () => {
    for (const agent of ['grok', 'claude']) {
      expect(
        decideWorkerStartMode({
          params: { agent },
          settings: { experimentalNativeChat: false }
        })
      ).toMatchObject({ mode: 'terminal', preferred: 'terminal', reason: 'user_default' })
    }
  })
})
