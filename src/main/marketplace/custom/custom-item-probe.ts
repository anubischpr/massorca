import type { LocalCommandProbe } from '../../ipc/preflight-command-exec'

/** A check command that runs longer than this leaves the item unverifiable. */
export const CUSTOM_CHECK_TIMEOUT_MS = 10_000

export type CustomItemPresence = 'found' | 'missing' | 'unverifiable'

export type CheckRun = { code: number | null; timedOut: boolean }

/** The machine access detection needs; the real one is wired in custom-item-env.ts. */
export type CustomItemProbeEnv = {
  /** Finds a program the way the Git install probe does: PATH plus the system install folders. */
  findCommand: (command: string) => Promise<LocalCommandProbe>
  /** Runs the resolved program; rejects only when it cannot be started. */
  runCheck: (program: string, args: readonly string[]) => Promise<CheckRun>
}

/**
 * Exit 0 is found. A program that cannot be started is missing. A timeout, a non-zero exit, or a
 * probe that could not run is unverifiable, because the app may still be installed.
 */
export async function detectCustomItemPresence(
  env: CustomItemProbeEnv,
  checkCommand: readonly string[] | null
): Promise<CustomItemPresence> {
  if (checkCommand === null) {
    return 'unverifiable'
  }
  const [program = '', ...args] = checkCommand
  const probe = await env.findCommand(program).catch(() => null)
  if (probe?.status === 'absent') {
    return 'missing'
  }
  if (probe?.status !== 'available') {
    return 'unverifiable'
  }
  try {
    const run = await env.runCheck(probe.binary, args)
    return !run.timedOut && run.code === 0 ? 'found' : 'unverifiable'
  } catch (error) {
    return isMissingProgram(error) ? 'missing' : 'unverifiable'
  }
}

/**
 * The argv an install runs. A bare program name is resolved first, because Windows only finds
 * `.cmd` shims such as npm by their full name. A path the person typed runs as typed.
 */
export async function resolveInstallArgv(
  env: Pick<CustomItemProbeEnv, 'findCommand'>,
  argv: readonly string[]
): Promise<readonly string[] | null> {
  const [program = '', ...args] = argv
  if (/[\\/]/.test(program)) {
    return argv
  }
  const probe = await env.findCommand(program).catch(() => null)
  return probe?.status === 'available' ? [probe.binary, ...args] : null
}

function isMissingProgram(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
