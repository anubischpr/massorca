import { AgentIcon } from '@/lib/agent-catalog'
import { GentleShellIcon } from '@/lib/agent-icon-gentle-shell'
import type { MarketplaceAppAgent } from '../../../../shared/marketplace-apps'

/** An agent's own icon; Gentle Shell keeps its rose. */
export function MarketplaceAgentMark({
  agent,
  size = 14
}: {
  agent: MarketplaceAppAgent
  size?: number
}): React.JSX.Element {
  return agent === 'gentle-shell' ? (
    <GentleShellIcon size={size} />
  ) : (
    <AgentIcon agent={agent} size={size} />
  )
}
