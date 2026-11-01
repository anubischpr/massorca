import { AgentIcon } from '@/lib/agent-catalog'
import { botAgentPiRuntime } from '../../../../shared/bot-team-character-art'
import type { BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'

/** Every bot surface draws its engine through here, so Gentle Shell always shows its own mark. */
export function BotAgentIcon({
  agent,
  size
}: {
  agent: BotTeamBot['agent'] | undefined
  size: number
}): React.JSX.Element {
  const piRuntime = agent ? botAgentPiRuntime(agent) : undefined
  return (
    <AgentIcon agent={agent} size={size} {...(piRuntime ? { chatPiRuntime: piRuntime } : {})} />
  )
}
