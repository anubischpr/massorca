import { useCallback, type RefObject } from 'react'
import { toast } from 'sonner'
import type { AgentType } from '../../../../shared/agent-status-types'
import { structuredAgentSessionOptionView } from '../../../../shared/structured-agent-session-option-view'
import {
  structuredAgentSessionOptionPicks,
  type StructuredAgentSessionOptionState
} from '../../../../shared/structured-agent-session-options'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { StructuredLaunchOptionOutcome } from '@/lib/structured-agent-session-launch-options'
import { agentSessionWriteFailureText } from './agent-session-write-notice-text'
import { enqueueSessionOptionSettingsWrite } from './native-chat-session-option-settings-write'

const NO_HELD_OPTIONS: Readonly<Record<string, string>> = {}

/** What a settled pick must remember so the next launch starts where the user left off. */
export function useStructuredAgentOptionPickMemory(args: {
  agent: AgentType
  target: RuntimeClientTarget
  optionStateRef: RefObject<StructuredAgentSessionOptionState>
  launchSeedOptions: Readonly<Record<string, string>> | undefined
}) {
  const { agent, target, optionStateRef, launchSeedOptions } = args
  const rememberOptionPicks = useCallback(
    (view: StructuredAgentSessionOptionState, committed: Readonly<Record<string, string>>) => {
      const picks = structuredAgentSessionOptionPicks(view, committed)
      if (picks.length > 0) {
        void enqueueSessionOptionSettingsWrite(target, { type: 'apply-picks', agent, picks })
      }
    },
    [agent, target]
  )
  const settleLaunchOptionPick = useCallback(
    (outcome: StructuredLaunchOptionOutcome) => {
      if (outcome.kind === 'refused') {
        toast.error(agentSessionWriteFailureText(outcome.failure, 'option'))
      } else if (outcome.kind === 'accepted') {
        rememberOptionPicks(
          structuredAgentSessionOptionView(
            optionStateRef.current,
            launchSeedOptions,
            NO_HELD_OPTIONS
          ),
          outcome.options
        )
      }
    },
    [launchSeedOptions, optionStateRef, rememberOptionPicks]
  )
  return { rememberOptionPicks, settleLaunchOptionPick }
}
