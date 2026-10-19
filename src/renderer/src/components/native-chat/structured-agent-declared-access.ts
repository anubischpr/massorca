import { agentSessionDeclaredAccess } from '../../../../shared/agent-session-access-mode'
import {
  isPiRuntimeSelection,
  resolvePiSessionRuntime,
  selectedPiRuntime,
  type PiRuntimeSelection
} from '../../../../shared/pi-runtime-selection'
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

/** The Pi runtime a structured chat runs on, read from the session before the client's Pi command
 *  setting: the host-recorded runtime, the session transcript's home, then the launch seed. Undefined
 *  for every other agent. */
export function structuredChatPiRuntime(args: {
  agent: string
  launchSeedOptions: Readonly<Record<string, string>> | undefined
  piCommand: string | undefined
  transcriptPath?: string | null
  hostRuntime?: unknown
}): PiRuntimeSelection | undefined {
  if (args.agent !== 'pi') {
    return undefined
  }
  return resolvePiSessionRuntime({
    hostRuntime: args.hostRuntime,
    transcriptPath: args.transcriptPath,
    launchSeed: args.launchSeedOptions?.piRuntime,
    command: args.piCommand
  })
}

/** The picks a running child accepts: modes it can switch to live, and picks it already satisfies. */
function runningSwitchableModes(
  state: Pick<StructuredAgentSessionOptionState, 'liveAccessModes' | 'recordOnlyAccessModes'>
): readonly string[] {
  return [...(state.liveAccessModes ?? []), ...(state.recordOnlyAccessModes ?? [])]
}

type ProviderPhase = { providerStarting?: boolean; providerRunning?: boolean }

/** A starting child takes no access pick; a running one only the modes it can switch to live. */
export function lockAccessWhileProviderRuns(
  snapshot: SessionOptionDescriptor[],
  phase: ProviderPhase,
  state: Pick<StructuredAgentSessionOptionState, 'liveAccessModes' | 'recordOnlyAccessModes'>
): SessionOptionDescriptor[] {
  if (phase.providerStarting) {
    return lockStructuredAgentSessionAccessOptions(snapshot)
  }
  return phase.providerRunning
    ? lockStructuredAgentSessionAccessOptions(snapshot, runningSwitchableModes(state))
    : snapshot
}

export function accessPickBlockedByProvider(
  phase: ProviderPhase,
  state: Pick<StructuredAgentSessionOptionState, 'liveAccessModes' | 'recordOnlyAccessModes'>,
  value: string | boolean
): boolean {
  return Boolean(
    phase.providerStarting ||
    (phase.providerRunning && !runningSwitchableModes(state).some((mode) => mode === value))
  )
}
