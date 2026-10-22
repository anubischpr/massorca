// Cross-version journeys for structured methods added after the surface first shipped. Each is a
// bare addition: an older host answers `method_not_found` (or, for the provider command, is never
// asked), and the journey shows the real client taking that without an error. The surface inventory
// itself, and the generic old-dispatcher answer for every method, live in
// cross-version-agent-session-wire.unit.test.ts.

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readNativeChatPlanDocument } from '../../../src/renderer/src/components/native-chat/native-chat-plan-document-read-client'
import { reportReplySuggestionDismissed } from '../../../src/renderer/src/components/native-chat/native-chat-reply-suggestion-dismissal'
import { RuntimeRpcCallError } from '../../../src/renderer/src/runtime/runtime-rpc-result'
import { resolveBaselineReleaseRef } from './release-checkout'
import { callBuild } from './structured-agent-session-surface-execution'
import { installableHost, structuredHostStub } from './structured-agent-session-host-fixture'
import { paramsFor, SESSION, WORKSPACE } from './structured-agent-session-surface-manifest'
import {
  loadAgentSessionWireBuild,
  WORKING_TREE,
  type AgentSessionWireBuild
} from './versioned-agent-session-wire'

// The clients' call helpers, answered by the baseline's own dispatcher in the journeys below.
const dismissalRpc = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: (...args: unknown[]) => dismissalRpc.call(...args)
}))
const planDocumentRpc = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: (...args: unknown[]) => planDocumentRpc.call(...args)
}))

// Why: a cold CI run extracts the baseline checkout before the first pairing.
const SUITE_TIMEOUT_MS = 180_000

let current: AgentSessionWireBuild
let baseline: AgentSessionWireBuild

beforeAll(async () => {
  current = await loadAgentSessionWireBuild(WORKING_TREE)
  baseline = await loadAgentSessionWireBuild(resolveBaselineReleaseRef())
}, SUITE_TIMEOUT_MS)

/** The structured methods the baseline release actually registers, read from it. */
function baselineStructuredMethods(): string[] {
  return baseline.methodNames.filter((name) => name.startsWith('agentSession.'))
}

describe('a new client against an old host, for methods added later', () => {
  // The plan document read is a bare addition, so the client has to tell "host too old" from
  // "contact lost": it reads the old dispatcher's refusal itself, not a thrown transport error.
  it('reads a host that predates the plan document read as unsupported, not as lost contact', async () => {
    const method = 'agentSession.readPlanDocument'
    const params = paramsFor(method)
    const [reply] = await callBuild(baseline, method, params, {
      clientKind: 'runtime',
      clientCapabilities: current.capabilities
    })
    planDocumentRpc.call.mockImplementationOnce(async () => {
      if (!reply?.ok) {
        throw new RuntimeRpcCallError({
          id: reply?.id ?? 'plan-document',
          ok: false,
          error: reply?.error ?? { code: 'no_reply', message: 'no reply' }
        })
      }
      return reply.result
    })
    const outcome = await readNativeChatPlanDocument({
      target: { kind: 'local' },
      sessionId: SESSION,
      path: '/home/dev/.gemini/antigravity-cli/brain/conversation-1/implementation_plan.md'
    })
    if (baselineStructuredMethods().includes(method)) {
      // The day a release ships the read, the old host answers it and nothing here is "unsupported".
      expect(outcome.kind).not.toBe('unsupported')
    } else {
      expect(reply, 'the old dispatcher must answer').toMatchObject({
        ok: false,
        error: { code: 'method_not_found' }
      })
      expect(outcome).toEqual({ kind: 'unsupported' })
    }
  })

  // Dismissing a suggestion tells the host so a restart does not bring it back. A host that
  // predates the method refuses it, and the chat keeps its own dismissal without an error.
  it('takes the refusal of a host that predates the suggestion dismissal without an error', async () => {
    const method = 'agentSession.dismissPromptSuggestion'
    const [reply] = await callBuild(baseline, method, paramsFor(method), {
      clientKind: 'runtime',
      clientCapabilities: current.capabilities
    })
    const answered = (async () => {
      if (!reply?.ok) {
        throw new RuntimeRpcCallError({
          id: reply?.id ?? 'dismissal',
          ok: false,
          error: reply?.error ?? { code: 'no_reply', message: 'no reply' }
        })
      }
      return reply.result
    })()
    dismissalRpc.call.mockReturnValueOnce(answered)
    reportReplySuggestionDismissed({ kind: 'local' }, SESSION, {
      turnId: 'turn-1',
      text: 'Run the tests',
      source: 'emulated'
    })
    if (baselineStructuredMethods().includes(method)) {
      await expect(answered).resolves.toBeDefined()
    } else {
      expect(reply, 'the old dispatcher must answer').toMatchObject({
        ok: false,
        error: { code: 'method_not_found' }
      })
      await expect(answered).rejects.toBeInstanceOf(RuntimeRpcCallError)
    }
    // The client swallowed the refusal: nothing is left unhandled for the runner to flag.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dismissalRpc.call).toHaveBeenCalledTimes(1)
  })

  // A client offers a provider command only where the host's options reported it, so the
  // method is never called on a host that predates it. Pin both halves: the old host reports no
  // commands, and the old dispatcher would refuse the call if one were sent anyway.
  it('is never asked for a provider command by a host whose options report none', async () => {
    const method = 'agentSession.providerCommand'
    const client = { clientKind: 'runtime' as const, clientCapabilities: current.capabilities }
    const hostCalls = structuredHostStub(SESSION, WORKSPACE)
    await baseline.installStructuredHost(installableHost(hostCalls))
    try {
      if (baseline.methodNames.includes('agentSession.options')) {
        const [options] = await callBuild(
          baseline,
          'agentSession.options',
          paramsFor('agentSession.options'),
          client
        )
        expect(options?.ok, JSON.stringify(options)).toBe(true)
        expect(options?.result).not.toHaveProperty('providerCommands')
      }
      if (!baselineStructuredMethods().includes(method)) {
        const [reply] = await callBuild(baseline, method, paramsFor(method), client)
        expect(reply).toMatchObject({ ok: false, error: { code: 'method_not_found' } })
      }
    } finally {
      await baseline.installStructuredHost(null)
    }
  })
})
