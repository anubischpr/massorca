import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import { hydrateShellPathForAgentDetection } from '../ipc/agent-detection-shell-path'
import {
  getPreflightWslTarget,
  type PreflightRuntimeContext
} from '../ipc/preflight-runtime-target'
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedPiRuntimes
} from '../ipc/tui-agent-detection-commands'
import { getActiveMultiplexer } from '../ssh/ssh-target-registry'
import { detectAgentCommandsOnHost } from './agent-command-detection'

// Why: the agent id list folds `pi` and `gentle-shell` into one `pi`, so the runtimes need their own answer.
const PI_DETECTION_COMMANDS = KNOWN_TUI_AGENT_DETECTION_COMMANDS.filter(
  (command) => command.id === 'pi'
)

/** The Pi runtimes on this host, probed with the `pi` agent's own commands. */
export async function detectInstalledPiRuntimes(
  context?: PreflightRuntimeContext
): Promise<PiRuntimeSelection[]> {
  const runtime = getPreflightWslTarget(context) ? 'wsl' : process.platform
  return resolveDetectedPiRuntimes(
    PI_DETECTION_COMMANDS,
    await detectAgentCommandsOnHost(
      getTuiAgentDetectionProbeCommands(PI_DETECTION_COMMANDS, runtime),
      { context }
    ),
    runtime
  )
}

export async function detectInstalledPiRuntimesWithShellPathHydration(
  context?: PreflightRuntimeContext
): Promise<PiRuntimeSelection[]> {
  await hydrateShellPathForAgentDetection(context)
  return detectInstalledPiRuntimes(context)
}

/** The Pi runtimes an SSH execution host has, probed over the connection `detectRemoteAgents` uses. */
export async function detectRemotePiRuntimes(args: {
  connectionId: string
}): Promise<PiRuntimeSelection[]> {
  const mux = getActiveMultiplexer(args.connectionId)
  if (!mux || mux.isDisposed()) {
    return []
  }
  // Why: the pi probes carry no platform-only entry, so the local platform does not change them.
  return resolveDetectedPiRuntimes(
    PI_DETECTION_COMMANDS,
    await detectAgentCommandsOnHost(
      getTuiAgentDetectionProbeCommands(PI_DETECTION_COMMANDS, process.platform),
      { connectionId: args.connectionId }
    ),
    process.platform
  )
}
