import { describe, expect, it } from 'vitest'
import type { AgentSessionSubscribeEvent } from '../../../../shared/agent-session-wire'
import { ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES } from '../../../../shared/electron-remote-runtime-client-capabilities'
import {
  AGENT_SESSION_PROMPT_SUGGESTION_RUNTIME_CAPABILITY,
  STRUCTURED_AGENT_SESSION_SURFACE_RUNTIME_CAPABILITIES
} from '../../../../shared/structured-agent-session-surface-capabilities'
import { DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES } from '../../../ipc/desktop-renderer-runtime-capabilities'
import { projectPromptSuggestionEvent } from './structured-agent-session-prompt-suggestion-capability'

const event: AgentSessionSubscribeEvent = {
  type: 'batch',
  sessionId: 's',
  batch: { cursor: { epoch: 'e', sequence: 1 }, items: [], removedItemIds: [], submissions: [] },
  hostNow: 5,
  promptSuggestion: { turnId: 't', text: 'Next', source: 'emulated' }
}

describe('prompt suggestion capability', () => {
  it('is advertised by hosts and by the desktop clients that draw it', () => {
    expect(STRUCTURED_AGENT_SESSION_SURFACE_RUNTIME_CAPABILITIES).toContain(
      AGENT_SESSION_PROMPT_SUGGESTION_RUNTIME_CAPABILITY
    )
    expect(ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES).toContain(
      AGENT_SESSION_PROMPT_SUGGESTION_RUNTIME_CAPABILITY
    )
    expect(DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES).toContain(
      AGENT_SESSION_PROMPT_SUGGESTION_RUNTIME_CAPABILITY
    )
  })

  it('keeps the field for in-process callers and for clients that advertise it', () => {
    expect(projectPromptSuggestionEvent(event, { clientKind: undefined })).toBe(event)
    expect(
      projectPromptSuggestionEvent(event, {
        clientKind: 'runtime',
        clientCapabilities: [AGENT_SESSION_PROMPT_SUGGESTION_RUNTIME_CAPABILITY]
      })
    ).toBe(event)
  })

  it('withholds it from a client that never advertised the capability', () => {
    const projected = projectPromptSuggestionEvent(event, {
      clientKind: 'runtime',
      clientCapabilities: []
    })
    expect(projected).not.toHaveProperty('promptSuggestion')
    expect(projected).toMatchObject({ type: 'batch', hostNow: 5 })
    const bare = { type: 'end' } as const
    expect(projectPromptSuggestionEvent(bare, { clientKind: 'runtime' })).toBe(bare)
  })
})
