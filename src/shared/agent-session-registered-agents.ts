/**
 * `agentSession.agents`: the structured agents a host registered, each with the capability record
 * its definition declares, so a client can show what an agent supports before any session of it
 * exists. Published only by hosts advertising the registered-agents capability.
 *
 * A host is newer than some of its clients, so the reply is read row by row: a row this build
 * cannot read is dropped and the rest are kept, and an arm this build does not know degrades to the
 * one that claims the least.
 */

import { z } from 'zod'
import type { AgentSessionCapabilities } from './agent-session-capabilities'
import {
  AGENT_SESSION_ACCESS_MODES,
  isAgentSessionPermissionPreset
} from './agent-session-access-mode'
import { isStructuredAgentId } from './agent-session-provider-handle-encoding'
import { openEnum } from './zod-salvage'

export const AGENT_SESSION_AGENTS_METHOD = 'agentSession.agents'

export type AgentSessionRegisteredAgent = {
  agent: string
  capabilities: AgentSessionCapabilities
}

export type AgentSessionAgentsResult = {
  agents: AgentSessionRegisteredAgent[]
}

/** Bounds one reply; no host registers anywhere near this many agents. */
const MAX_REGISTERED_AGENTS = 128

// A preset this build does not know is dropped, so a newer host's extra preset costs only that preset.
const permissionPresets = z
  .array(z.string())
  .max(16)
  .transform((values) => values.filter(isAgentSessionPermissionPreset))

// An absent flag is a capability the host did not claim.
const capabilityFlag = z.boolean().optional().default(false)

const registeredAgentSchema = z.object({
  agent: z.string().refine(isStructuredAgentId),
  capabilities: z.object({
    rewind: capabilityFlag,
    compact: capabilityFlag,
    threadGoal: capabilityFlag,
    contextUsage: capabilityFlag,
    imagePrompts: capabilityFlag,
    // Holding a follow-up until the turn ends never interrupts one the client cannot reason about.
    steering: openEnum(['inject', 'queue'] as const, 'queue')
      .optional()
      .default('queue'),
    // `orca` claims only that Orca answers the agent's requests, never that it confines the agent.
    approvalEnforcement: openEnum(['provider', 'orca'] as const, 'orca')
      .optional()
      .default('orca'),
    supportedAccessModes: z.array(z.enum(AGENT_SESSION_ACCESS_MODES)).max(2).optional(),
    supportedPermissionPresets: permissionPresets.optional(),
    runtimeAccess: z
      .record(
        z.string().max(64),
        z.object({
          modes: z.array(z.enum(AGENT_SESSION_ACCESS_MODES)).max(2),
          presets: permissionPresets.optional()
        })
      )
      .optional()
  })
})

/** The host's agents as this build reads them, or null when the reply is not an agent list. */
export function decodeAgentSessionAgentsResult(
  value: unknown
): AgentSessionRegisteredAgent[] | null {
  if (typeof value !== 'object' || value === null || !('agents' in value)) {
    return null
  }
  const { agents } = value
  if (!Array.isArray(agents)) {
    return null
  }
  const seen = new Set<string>()
  const decoded: AgentSessionRegisteredAgent[] = []
  for (const row of agents.slice(0, MAX_REGISTERED_AGENTS)) {
    const parsed = registeredAgentSchema.safeParse(row)
    if (parsed.success && !seen.has(parsed.data.agent)) {
      seen.add(parsed.data.agent)
      decoded.push(parsed.data)
    }
  }
  return decoded
}
