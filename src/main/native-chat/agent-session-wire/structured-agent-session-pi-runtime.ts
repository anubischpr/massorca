import type { AgentSessionRecord } from '../../../shared/agent-session-record'

/** The Gentle Shell marker a structured record puts on the wire; stock Pi and other agents read as none. */
export function structuredAgentSessionGentleShellMarker(
  record: Pick<AgentSessionRecord, 'provider' | 'options'> | null | undefined
): 'gentle-shell' | undefined {
  return record?.provider === 'pi' && record.options?.piRuntime === 'gentle-shell'
    ? 'gentle-shell'
    : undefined
}
