import { Checkbox } from '@/components/ui/checkbox'
import type {
  MarketplaceAgentAccess,
  MarketplaceAppAgent
} from '../../../../shared/marketplace-apps'
import { MARKETPLACE_APP_AGENTS } from '../../../../shared/marketplace-apps'
import { MarketplaceAgentMark } from './marketplace-agent-mark'
import { marketplaceAgentLabel } from './marketplace-catalog'
import { withAgentPicked } from './MarketplaceAppAccessEdit'

/** The agents a limited app is picked for, one check box each, with their own icons. */
export function MarketplaceAppAccessAgents({
  agents,
  disabled,
  onChange
}: {
  agents: MarketplaceAgentAccess
  disabled: boolean
  onChange: (next: MarketplaceAgentAccess) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {MARKETPLACE_APP_AGENTS.map((agent) => (
        <AgentCheckRow
          key={agent}
          agent={agent}
          checked={agents.ids.includes(agent)}
          disabled={disabled}
          onPick={(picked) => onChange(withAgentPicked(agents, agent, picked))}
        />
      ))}
    </div>
  )
}

function AgentCheckRow({
  agent,
  checked,
  disabled,
  onPick
}: {
  agent: MarketplaceAppAgent
  checked: boolean
  disabled: boolean
  onPick: (picked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onPick(next === true)}
      />
      <MarketplaceAgentMark agent={agent} />
      <span>{marketplaceAgentLabel(agent)}</span>
    </label>
  )
}
