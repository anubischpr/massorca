import type { AgentSessionExplicitAccess } from './agent-session-access-mode'

/** The explicit mode a pick runs as: itself, or for `inherit` what the global setting resolves to. */
export function agentSessionAccessPosture(
  value: string | undefined,
  inheritedFullAccess: boolean
): AgentSessionExplicitAccess | null {
  if (value === undefined || value === 'inherit') {
    return inheritedFullAccess ? 'full-access' : 'default'
  }
  return value === 'default' || value === 'full-access' || isPreset(value) ? value : null
}

function isPreset(
  value: string
): value is Exclude<AgentSessionExplicitAccess, 'default' | 'full-access'> {
  return value === 'auto' || value === 'accept-edits' || value === 'plan' || value === 'read-only'
}

/**
 * Whether switching a running session to `target` changes nothing the child does: the child already
 * runs exactly the posture `target` names, so only the record (what later starts and global changes
 * follow) differs. It never widens: a target broader than the running posture is not equivalent.
 * Unknown evidence (no running posture, no global answer) is never equivalent.
 */
export function accessPickChangesOnlyRecord(input: {
  current: string | undefined
  target: string
  running: AgentSessionExplicitAccess | undefined
  inheritedFullAccess: boolean | undefined
}): boolean {
  const { running, inheritedFullAccess } = input
  if (
    running === undefined ||
    inheritedFullAccess === undefined ||
    input.target === (input.current ?? 'inherit')
  ) {
    return false
  }
  return agentSessionAccessPosture(input.target, inheritedFullAccess) === running
}
