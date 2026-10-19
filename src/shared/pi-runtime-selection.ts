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

/** The runtime whose session store holds a Pi-protocol transcript, read from its `.gentle-shell` home segment. */
export function piRuntimeForSessionFilePath(
  filePath: string | null | undefined
): PiRuntimeSelection {
  return filePath && /[\\/]\.gentle-shell[\\/]/.test(filePath) ? 'gentle-shell' : 'pi'
}

/**
 * The runtime an existing Pi chat runs on. The session's own evidence wins over the client's global
 * Pi command: a Gentle Shell chat never resumes as stock `pi` because this client names no runtime.
 * Order: the host's recorded runtime, a `.gentle-shell` transcript, the launch seed, a known stock
 * transcript, then the command setting (only for a chat that has no session evidence yet).
 */
export function resolvePiSessionRuntime(args: {
  hostRuntime?: unknown
  transcriptPath?: string | null
  launchSeed?: unknown
  command?: string
}): PiRuntimeSelection {
  if (isPiRuntimeSelection(args.hostRuntime)) {
    return args.hostRuntime
  }
  if (piRuntimeForSessionFilePath(args.transcriptPath) === 'gentle-shell') {
    return 'gentle-shell'
  }
  if (isPiRuntimeSelection(args.launchSeed)) {
    return args.launchSeed
  }
  return args.transcriptPath ? 'pi' : selectedPiRuntime(args.command)
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
