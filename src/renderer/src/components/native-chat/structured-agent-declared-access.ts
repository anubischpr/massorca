import { agentSessionDeclaredAccess } from '../../../../shared/agent-session-access-mode'
import { isPiRuntimeSelection, selectedPiRuntime } from '../../../../shared/pi-runtime-selection'
import type { SessionOptionDescriptor } from '../../../../shared/native-chat-session-options'
import { lockStructuredAgentSessionAccessOptions } from '../../../../shared/structured-agent-session-access-option'
import type { StructuredAgentSessionOptionState } from '../../../../shared/structured-agent-session-options'
import { useHostStructuredAgent } from '@/runtime/use-host-structured-agent'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { useAppStore } from '@/store'

/** The access modes and presets the chat's host declares for its agent, resolved for the Pi
 *  runtime a new launch names; a reopened chat learns its own from the host's first options read. */
export function useStructuredAgentDeclaredAccess(args: {
  agent: string
  target: RuntimeClientTarget
  launchSeedOptions: Readonly<Record<string, string>> | undefined
  launching: boolean
}) {
  const { agent, target, launchSeedOptions, launching } = args
  const registeredAgent = useHostStructuredAgent(target, agent)
  const piCommand = useAppStore((state) => state.settings?.agentCmdOverrides?.pi)
  const piRuntime =
    agent !== 'pi'
      ? undefined
      : isPiRuntimeSelection(launchSeedOptions?.piRuntime)
        ? launchSeedOptions.piRuntime
        : launching
          ? selectedPiRuntime(piCommand)
          : undefined
  return agentSessionDeclaredAccess(registeredAgent?.capabilities, piRuntime)
}

type ProviderPhase = { providerStarting?: boolean; providerRunning?: boolean }

/** A starting child takes no access pick; a running one only the modes it can switch to live. */
export function lockAccessWhileProviderRuns(
  snapshot: SessionOptionDescriptor[],
  phase: ProviderPhase,
  state: Pick<StructuredAgentSessionOptionState, 'liveAccessModes'>
): SessionOptionDescriptor[] {
  if (phase.providerStarting) {
    return lockStructuredAgentSessionAccessOptions(snapshot)
  }
  return phase.providerRunning
    ? lockStructuredAgentSessionAccessOptions(snapshot, state.liveAccessModes)
    : snapshot
}

export function accessPickBlockedByProvider(
  phase: ProviderPhase,
  state: Pick<StructuredAgentSessionOptionState, 'liveAccessModes'>,
  value: string | boolean
): boolean {
  return Boolean(
    phase.providerStarting ||
    (phase.providerRunning && !(state.liveAccessModes ?? []).some((mode) => mode === value))
  )
}
