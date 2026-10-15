import { useMemo } from 'react'
import type { AgentType } from '../../../../shared/agent-status-types'
import { getVerifiedNativeChatCommands } from '../../../../shared/native-chat-agent-profiles'
import {
  sessionReportedSkillNames,
  type SlashCommandSuggestion
} from '../../../../shared/native-chat-slash-commands'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'
import { nativeChatStructuredCatalog } from './native-chat-session-navigation'

export type NativeChatComposerCatalog = {
  agentCommands: readonly SlashCommandSuggestion[]
  sessionSkillNames: readonly string[] | undefined
}

/**
 * What the `/` menu offers. A structured session reports the surface it actually
 * loaded — the only list that includes this repo's own commands and the skills
 * that reach the session through plugin roots — so it wins whenever it is
 * present. The curated per-agent catalog remains the answer for the PTY lane and
 * for a host that predates the report.
 */
export function useNativeChatComposerCatalog(
  agent: AgentType,
  structuredTransport?: NativeChatStructuredComposerTransport
): NativeChatComposerCatalog {
  const structured = Boolean(structuredTransport)
  const functions = structuredTransport?.sessionFunctions
  const reported = structuredTransport?.sessionCommands
  const conversationCommands = structuredTransport?.conversationCommands
  const agentCommands = useMemo(
    () =>
      structured
        ? nativeChatStructuredCatalog(agent, {
            sessionFunctions: functions,
            sessionCommands: reported,
            conversationCommands
          })
        : getVerifiedNativeChatCommands(agent),
    [agent, conversationCommands, functions, reported, structured]
  )
  const sessionSkillNames = useMemo(
    () => (reported !== undefined ? sessionReportedSkillNames(reported) : undefined),
    [reported]
  )
  return { agentCommands, sessionSkillNames }
}
