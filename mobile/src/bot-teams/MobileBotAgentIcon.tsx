import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { botAgentPiRuntime } from '../../../src/shared/bot-team-character-art'

/** Every bot surface draws its engine through here, so Gentle Shell always shows its own mark. */
export function MobileBotAgentIcon({ agentId, size }: { agentId: string; size?: number }) {
  const piRuntime = botAgentPiRuntime(agentId)
  return (
    <MobileAgentIcon
      agentId={agentId}
      {...(size === undefined ? {} : { size })}
      {...(piRuntime ? { piRuntime } : {})}
    />
  )
}
