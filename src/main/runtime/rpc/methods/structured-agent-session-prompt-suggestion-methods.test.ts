import { afterEach, describe, expect, it } from 'vitest'
import type { NativeChatReplySuggestion } from '../../../../shared/native-chat-reply-suggestion'
import { setStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import { hostTestState } from '../../../native-chat/agent-session-wire/structured-agent-session-host-test-harness'
import type { RpcContext } from '../core'
import { STRUCTURED_AGENT_SESSION_PROMPT_SUGGESTION_METHODS } from './structured-agent-session-prompt-suggestion-methods'

const [dismiss] = STRUCTURED_AGENT_SESSION_PROMPT_SUGGESTION_METHODS
const SESSION = 'dismiss-session'
const SUGGESTION: NativeChatReplySuggestion = {
  turnId: 'turn-1',
  text: 'Run the tests',
  source: 'native'
}

/** An in-process caller, which the structured gate admits without a negotiated capability. */
function inProcessContext(): RpcContext {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the dismissal reads only `clientKind` through its gate, which an in-process caller leaves undefined; the handler reads nothing else from the context.
  return { clientKind: undefined } as unknown as RpcContext
}

afterEach(() => {
  setStructuredAgentSessionHost(null)
})

describe('agentSession.dismissPromptSuggestion', () => {
  it('drops the held suggestion it names, and reports a key that matches nothing', async () => {
    const { host } = hostTestState()
    setStructuredAgentSessionHost(host)
    host.promptSuggestions.publish(SESSION, SUGGESTION)

    const stale = dismiss.params.parse({
      sessionId: SESSION,
      turnId: 'turn-0',
      text: SUGGESTION.text
    })
    expect(await dismiss.handler(stale, inProcessContext())).toEqual({ dismissed: false })
    expect(host.promptSuggestions.get(SESSION)).toEqual(SUGGESTION)

    const named = dismiss.params.parse({
      sessionId: SESSION,
      turnId: SUGGESTION.turnId,
      text: SUGGESTION.text
    })
    expect(await dismiss.handler(named, inProcessContext())).toEqual({ dismissed: true })
    expect(host.promptSuggestions.get(SESSION)).toBeUndefined()
  })

  it('refuses params it does not know, and text longer than a suggestion can be', () => {
    expect(() =>
      dismiss.params.parse({ sessionId: SESSION, turnId: 'turn-1', text: 'x', extra: true })
    ).toThrow()
    expect(() =>
      dismiss.params.parse({ sessionId: SESSION, turnId: 'turn-1', text: 'x'.repeat(241) })
    ).toThrow()
  })
})
