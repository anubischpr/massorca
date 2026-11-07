import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { StructuredAgentSessionCreateSupport } from '../native-chat/structured-agent-session-create-support'
import { checkRegisteredAgents, type AgentCheckRuntime } from './delegation-agent-listing'

const WORKSPACE_ID = 'repo1::/work/app'
const SELECTOR = `id:${WORKSPACE_ID}`

type Verdict = (
  agent: string,
  piRuntime: PiRuntimeSelection | undefined
) => StructuredAgentSessionCreateSupport | Promise<StructuredAgentSessionCreateSupport>

/** A host whose create checks give `verdict`; `check` is the mock the listing calls. */
function hostWhere(verdict: Verdict) {
  const check = vi.fn(async (_selector: string, agent: string, piRuntime?: PiRuntimeSelection) =>
    verdict(agent, piRuntime)
  )
  const runtime: AgentCheckRuntime = { getStructuredAgentSessionCreateSupport: check }
  return { runtime, check }
}

/** Stock Pi is refused without full access; Gentle Shell and every other agent run. */
const stockPiNeedsFullAccess: Verdict = (agent, piRuntime) =>
  agent === 'pi' && piRuntime !== 'gentle-shell'
    ? { supported: false, reason: 'access' }
    : { supported: true }

describe('checkRegisteredAgents', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('checks the Pi runtime a request names, so a Gentle Shell bot is listed where stock Pi is refused', async () => {
    const { runtime, check } = hostWhere(stockPiNeedsFullAccess)

    const checked = await checkRegisteredAgents(runtime, WORKSPACE_ID, 'gentle-shell')

    expect(check).toHaveBeenCalledWith(SELECTOR, 'pi', 'gentle-shell')
    expect(checked.usable).toContainEqual({
      agent: 'pi',
      label: 'Gentle Shell',
      piRuntime: 'gentle-shell'
    })
    expect(checked.refused.map((entry) => entry.agent)).not.toContain('pi')
  })

  it('leaves stock Pi out, with its refusal, when the request names no Pi runtime', async () => {
    const { runtime, check } = hostWhere(stockPiNeedsFullAccess)

    const checked = await checkRegisteredAgents(runtime, WORKSPACE_ID)

    expect(check).toHaveBeenCalledWith(SELECTOR, 'pi', undefined)
    expect(checked.usable.map((entry) => entry.agent)).not.toContain('pi')
    expect(checked.refused).toContainEqual(
      expect.objectContaining({ agent: 'pi', label: 'Pi', reason: 'access' })
    )
  })

  it('lists the Gentle Shell an unnamed Pi request resolved to, as before', async () => {
    const { runtime } = hostWhere((agent) =>
      agent === 'pi' ? { supported: true, piRuntime: 'gentle-shell' } : { supported: true }
    )

    const checked = await checkRegisteredAgents(runtime, WORKSPACE_ID)

    expect(checked.usable).toContainEqual({
      agent: 'pi',
      label: 'Gentle Shell',
      piRuntime: 'gentle-shell'
    })
  })

  it('names the reason a check gave, with its cause', async () => {
    const { runtime } = hostWhere((agent) =>
      agent === 'codex'
        ? { supported: false, reason: 'agent', cause: 'cliMissing' }
        : { supported: true }
    )

    const checked = await checkRegisteredAgents(runtime, WORKSPACE_ID)

    expect(checked.refused).toContainEqual(
      expect.objectContaining({ agent: 'codex', label: 'Codex', reason: 'agent: cliMissing' })
    )
  })

  it('names a check that throws as failed, and leaves that agent out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { runtime } = hostWhere((agent) => {
      if (agent === 'claude') {
        throw new Error('probe crashed')
      }
      return { supported: true }
    })

    const checked = await checkRegisteredAgents(runtime, WORKSPACE_ID)

    expect(checked.usable.map((entry) => entry.agent)).not.toContain('claude')
    expect(checked.refused).toContainEqual(
      expect.objectContaining({ agent: 'claude', reason: 'check failed' })
    )
    expect(warn).toHaveBeenCalled()
  })
})
