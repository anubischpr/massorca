import { resolveAgentSessionFullAccess } from '../../shared/agent-session-access-mode'

const ANTIGRAVITY_MODE_FLAGS = {
  auto: 'auto',
  'accept-edits': 'accept-edits',
  plan: 'plan'
} as const

/** `--mode` for a preset (agy 1.3.5: accept-edits, auto, plan), the skip flag for full access, and
 *  nothing for the CLI's own approving default. */
export function antigravityAccessArgs(
  accessMode: string | undefined,
  inheritedFullAccess: boolean
): string[] {
  if (accessMode === 'auto' || accessMode === 'accept-edits' || accessMode === 'plan') {
    return ['--mode', ANTIGRAVITY_MODE_FLAGS[accessMode]]
  }
  return resolveAgentSessionFullAccess(accessMode, inheritedFullAccess)
    ? ['--dangerously-skip-permissions']
    : []
}
