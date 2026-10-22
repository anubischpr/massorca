import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { NATIVE_CHAT_SUPPORTED_AGENT_LIST } from '../../../../shared/native-chat-agent-support'
import { AgentIcon, getAgentDisplayLabel } from '@/lib/agent-catalog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

/** Names the agents so unsupported-agent terminal fallback does not look broken. */
export function NativeChatSupportedAgents(): React.JSX.Element {
  const piRuntime = usePiDisplayRuntime()
  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        <span>
          {translate(
            'auto.components.settings.NativeChatSupportedAgents.label',
            'Supported agents:'
          )}
        </span>
        {NATIVE_CHAT_SUPPORTED_AGENT_LIST.map((agent) => {
          const label = getAgentDisplayLabel(agent, piRuntime)
          return (
            <Tooltip key={agent}>
              <TooltipTrigger asChild>
                <span data-agent={agent} role="img" aria-label={label}>
                  <AgentIcon agent={agent} size={13} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
