import type { TuiAgent } from './tui-agent'
import {
  getTuiAgentDetectCommands,
  TUI_AGENT_CONFIG,
  type TuiAgentConfig,
  type TuiAgentDetectionRuntime
} from './tui-agent-config'
import { isPiRuntimeSelection, type PiRuntimeSelection } from './pi-runtime-selection'

export type TuiAgentDetectionCommand = {
  id: TuiAgent
  cmd: string
  /** Ask an execution host to report this CLI's `--version` output when found. */
  reportVersion?: true
  requiredCommands?: readonly string[]
  unsupportedRuntimes?: readonly TuiAgentDetectionRuntime[]
}

export const KNOWN_TUI_AGENT_DETECTION_COMMANDS = buildTuiAgentDetectionCommands()

function buildTuiAgentDetectionCommands(): TuiAgentDetectionCommand[] {
  return Object.entries(TUI_AGENT_CONFIG).flatMap(([id, config]) =>
    getTuiAgentDetectCommands(config).map((cmd) =>
      buildTuiAgentDetectionCommand(id as TuiAgent, cmd, config)
    )
  )
}

function buildTuiAgentDetectionCommand(
  id: TuiAgent,
  cmd: string,
  config: TuiAgentConfig
): TuiAgentDetectionCommand {
  return {
    id,
    cmd,
    ...(config.detectRequiredCommands?.length
      ? { requiredCommands: config.detectRequiredCommands }
      : {}),
    ...(config.detectUnsupportedRuntimes?.length
      ? { unsupportedRuntimes: config.detectUnsupportedRuntimes }
      : {})
  }
}

export function getTuiAgentDetectionProbeCommands(
  commands: readonly TuiAgentDetectionCommand[],
  runtime: TuiAgentDetectionRuntime
): string[] {
  return [
    ...new Set(
      commands.flatMap((command) =>
        isDetectionUnsupportedInRuntime(command, runtime)
          ? []
          : [command.cmd, ...(command.requiredCommands ?? [])]
      )
    )
  ]
}

export function resolveDetectedTuiAgentIds(
  commands: readonly TuiAgentDetectionCommand[],
  foundCommands: ReadonlySet<string>,
  runtime: TuiAgentDetectionRuntime
): TuiAgent[] {
  const detected = commands
    .filter(
      (command) =>
        !isDetectionUnsupportedInRuntime(command, runtime) &&
        foundCommands.has(command.cmd) &&
        (command.requiredCommands ?? []).every((required) => foundCommands.has(required))
    )
    .map(({ id }) => id)
  return [...new Set(detected)]
}

/** The Pi runtimes whose binary resolved: `pi` and its `gentle-shell` alias both fold into the `pi`
 *  agent id, so this reads the command names that resolveDetectedTuiAgentIds drops. */
export function resolveDetectedPiRuntimes(
  commands: readonly TuiAgentDetectionCommand[],
  foundCommands: ReadonlySet<string>,
  runtime: TuiAgentDetectionRuntime
): PiRuntimeSelection[] {
  const detected: PiRuntimeSelection[] = []
  for (const command of commands) {
    const cmd = command.cmd
    if (
      command.id === 'pi' &&
      isPiRuntimeSelection(cmd) &&
      !isDetectionUnsupportedInRuntime(command, runtime) &&
      foundCommands.has(cmd) &&
      (command.requiredCommands ?? []).every((required) => foundCommands.has(required))
    ) {
      detected.push(cmd)
    }
  }
  return detected
}

export function isDetectionUnsupportedInRuntime(
  command: TuiAgentDetectionCommand,
  runtime: TuiAgentDetectionRuntime
): boolean {
  return command.unsupportedRuntimes?.includes(runtime) === true
}
