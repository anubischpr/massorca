import type { AgentSessionAccessMode } from '../../../shared/agent-session-access-mode'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { isTuiAgent } from '../../../shared/tui-agent-config'
import { resolvedTuiAgentArgsBypassPermissions } from '../../../shared/tui-agent-launch-defaults'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { getCatalogPlatform } from './agent-catalog-platform'

/** What `inherit` resolves to for `agent`, mirroring the host's `resolveAgentFullAccess`: the global
 *  default args carry the agent's bypass flag. Null when this client cannot know it: the settings are
 *  not loaded, or the chat runs on another host whose settings this client does not read. */
export function structuredAgentInheritedAccess(
  agent: string,
  target: RuntimeClientTarget,
  settings: GlobalSettings | null | undefined
): AgentSessionAccessMode | null {
  if (target.kind !== 'local' || !settings || !isTuiAgent(agent)) {
    return null
  }
  return resolvedTuiAgentArgsBypassPermissions(agent, settings, getCatalogPlatform())
    ? 'full-access'
    : 'default'
}
