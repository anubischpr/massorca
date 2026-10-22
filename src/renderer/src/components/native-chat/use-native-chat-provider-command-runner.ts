import { useCallback } from 'react'
import { toast } from 'sonner'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { resumeProviderSessionInNewStructuredChat } from '@/lib/provider-session-structured-chat-resume'
import { translate } from '@/i18n/i18n'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { AgentSessionProviderCommand } from '../../../../shared/agent-session-provider-command'
import { isAgentSessionAdoptableProvider } from '../../../../shared/agent-session-provider-handle'
import type { StructuredAgentSessionCommandOutcome } from '../../../../shared/structured-agent-session-composer'
import type { StructuredAgentSessionProviderCommands } from './use-structured-agent-session-provider-commands'

/** Runs a provider command and finishes what its answer asks of the client: `/fork` opens the new
 *  conversation as a chat. Rows the command wrote reach the transcript through the journal. */
export function useNativeChatProviderCommandRunner(args: {
  agent: AgentType
  worktreeId: string | undefined
  commands: StructuredAgentSessionProviderCommands
}): (
  command: AgentSessionProviderCommand,
  argument: string | undefined
) => Promise<Omit<StructuredAgentSessionCommandOutcome, 'handled'>> {
  const { agent, worktreeId } = args
  const { run } = args.commands
  return useCallback(
    async (command, argument) => {
      const result = await run(command, argument)
      // A refusal was reported by the write itself; the draft stays for another try.
      if (result === null) {
        return { accepted: false, error: null }
      }
      const forked = result.forkedProviderSessionId
      if (forked) {
        if (!worktreeId || !isAgentSessionAdoptableProvider(agent)) {
          return {
            accepted: true,
            error: translate(
              'components.native-chat.composer.forkNotOpened',
              'The fork was created, but this chat cannot open it. Find it in Sessions.'
            )
          }
        }
        resumeProviderSessionInNewStructuredChat({
          agent,
          worktreeId,
          providerSessionId: forked,
          requestId: newAgentLaunchRequestId(),
          onFailed: () =>
            toast.error(
              translate(
                'components.native-chat.composer.forkOpenFailed',
                'The fork was created, but it could not be opened. Find it in Sessions.'
              )
            )
        })
      }
      return { accepted: true, error: null }
    },
    [agent, run, worktreeId]
  )
}
