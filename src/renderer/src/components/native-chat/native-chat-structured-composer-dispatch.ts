import type { StructuredAgentSessionCommandOutcome } from '../../../../shared/structured-agent-session-composer'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'
import type { NativeChatComposerImageAttachment } from './NativeChatComposerField'
import type { AgentType } from '../../../../shared/agent-status-types'
import {
  nativeChatStructuredCatalog,
  isNativeChatSessionNavigation,
  openNativeChatSessionNavigation
} from './native-chat-session-navigation'

export async function dispatchNativeChatStructuredComposerText(
  transport: NativeChatStructuredComposerTransport,
  text: string,
  attachments: readonly NativeChatComposerImageAttachment[] = [],
  agent?: AgentType
): Promise<Omit<StructuredAgentSessionCommandOutcome, 'handled'> & { revealsTranscript: boolean }> {
  if (isNativeChatSessionNavigation(text)) {
    if (attachments.length > 0) {
      return {
        accepted: false,
        error: 'Remove attachments before using a chat-session command.',
        revealsTranscript: false
      }
    }
    await openNativeChatSessionNavigation()
    return { accepted: true, error: null, revealsTranscript: false }
  }
  const name = /^\/(\S+)/.exec(text.trim())?.[1]?.toLowerCase()
  const entry =
    name &&
    agent &&
    nativeChatStructuredCatalog(agent, transport).find((entry) => entry.name === name)
  if (entry && entry.providerFunction?.availability === 'terminal-only') {
    return {
      accepted: false,
      error: `/${name} is available in Terminal only.`,
      revealsTranscript: false
    }
  }
  const { handled, ...command } = await transport.dispatchCommand(text)
  // A command's reveal, if any, came at the press; a message reveals unless it waits as a queued card.
  if (handled) {
    return { ...command, revealsTranscript: false }
  }
  const admission = transport.send(text, attachments)
  return { accepted: admission !== false, error: null, revealsTranscript: admission === true }
}
