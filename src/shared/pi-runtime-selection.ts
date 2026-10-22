import { getCommandTokenPathBasename, getFirstCommandToken } from './command-token-scanner'

export type PiRuntimeSelection = 'pi' | 'gentle-shell'

/** The agent home each Pi-protocol runtime keeps under the user's home directory. */
export const PI_RUNTIME_HOME_DIR_NAME: Readonly<Record<PiRuntimeSelection, string>> = {
  pi: '.pi',
  'gentle-shell': '.gentle-shell'
}

export function isPiRuntimeSelection(value: unknown): value is PiRuntimeSelection {
  return value === 'pi' || value === 'gentle-shell'
}

/** The client sends an identity; the executing host resolves its own executable path.
 *  Reads the launch binary, so a TUI launch carrying arguments resolves too. */
export function selectedPiRuntime(command: string | undefined): PiRuntimeSelection {
  const binary = getCommandTokenPathBasename(getFirstCommandToken(command ?? '')).toLowerCase()
  return /^gentle-shell(?:\.(?:cmd|bat|exe))?$/.test(binary) ? 'gentle-shell' : 'pi'
}

/** A paired host rebuilds an agent launch from its own settings, which cannot name the client's Gentle
 *  Shell choice, so a Gentle Shell launch must travel as its prepared command. */
export function launchCarriesGentleShellCommand(
  agent: string | undefined,
  command: string | undefined
): boolean {
  return agent === 'pi' && selectedPiRuntime(command) === 'gentle-shell'
}

/** The runtime whose session store holds a Pi-protocol transcript, read from its `.gentle-shell` home segment. */
export function piRuntimeForSessionFilePath(
  filePath: string | null | undefined
): PiRuntimeSelection {
  return filePath && /[\\/]\.gentle-shell[\\/]/.test(filePath) ? 'gentle-shell' : 'pi'
}

/** The Pi runtime a host runs for a terminal launch: stock `pi`, Gentle Shell, neither, or `unknown`
 *  when the host did not say (an older host, an unreachable one), which keeps the stock command. */
export type HostPiTerminalRuntime = PiRuntimeSelection | 'cliMissing' | 'unknown'

/** Everything that can name the Pi runtime of a session or launch, in the order the resolver reads it. */
export type PiRuntimeEvidence = {
  /** `options.piRuntime` the executing host recorded for the session. */
  hostRecorded?: unknown
  /** The session transcript; a `.gentle-shell` home names Gentle Shell, any other path is stock. */
  transcriptPath?: string | null
  /** The runtime the launch was created with. */
  launchSeed?: unknown
  /** What the workspace's host says it runs; only a Gentle Shell fallback decides, and never over a command the client names. */
  hostAnswer?: HostPiTerminalRuntime
  /** The client's Pi command setting. */
  command?: string
}

/** The runtime the session itself names, or undefined when it has no evidence yet. A known stock
 *  transcript counts, so a stock chat is never moved to Gentle Shell by a host answer or a setting. */
export function piRuntimeFromSessionEvidence(
  evidence: Pick<PiRuntimeEvidence, 'hostRecorded' | 'transcriptPath' | 'launchSeed'>
): PiRuntimeSelection | undefined {
  if (isPiRuntimeSelection(evidence.hostRecorded)) {
    return evidence.hostRecorded
  }
  if (piRuntimeForSessionFilePath(evidence.transcriptPath) === 'gentle-shell') {
    return 'gentle-shell'
  }
  if (isPiRuntimeSelection(evidence.launchSeed)) {
    return evidence.launchSeed
  }
  return evidence.transcriptPath ? 'pi' : undefined
}

/**
 * The one answer to "which Pi does this session or launch run". Gentle Shell has its own identity, so
 * a Gentle Shell chat never starts as stock `pi` because this client names no runtime. Order: the
 * host-recorded runtime, a `.gentle-shell` transcript, the launch seed, a known stock transcript,
 * the host's Gentle Shell fallback (for a client that names no Pi command), the client's Pi command,
 * then stock `pi`.
 */
export function resolvePiRuntime(evidence: PiRuntimeEvidence): PiRuntimeSelection {
  return (
    piRuntimeFromSessionEvidence(evidence) ??
    (evidence.hostAnswer === 'gentle-shell' && !evidence.command?.trim()
      ? 'gentle-shell'
      : selectedPiRuntime(evidence.command))
  )
}

export function hasExplicitPiCommand(cmdOverrides: Partial<Record<string, string>>): boolean {
  return Boolean(cmdOverrides.pi?.trim())
}

/** The Pi command settings a terminal launch uses: the command the client names, or the runtime the
 *  host answered when it runs only Gentle Shell, never a stock `pi` it does not have. */
export function piTerminalCommandOverrides<T extends Partial<Record<string, string>>>(
  cmdOverrides: T,
  hostRuntime: HostPiTerminalRuntime
): T {
  const runtime = resolvePiRuntime({ hostAnswer: hostRuntime, command: cmdOverrides.pi })
  return runtime === selectedPiRuntime(cmdOverrides.pi)
    ? cmdOverrides
    : { ...cmdOverrides, pi: runtime }
}

export function piRuntimeCommandSettings<
  T extends { agentCmdOverrides?: Partial<Record<string, string>> }
>(settings: T, runtime: PiRuntimeSelection) {
  const configured = settings.agentCmdOverrides?.pi
  if (configured && selectedPiRuntime(configured) === runtime) {
    return settings
  }
  const agentCmdOverrides = { ...settings.agentCmdOverrides }
  if (runtime === 'pi') {
    delete agentCmdOverrides.pi
  } else {
    agentCmdOverrides.pi = runtime
  }
  return { ...settings, agentCmdOverrides }
}
