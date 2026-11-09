import { delimiter } from 'node:path'
import { homedir } from 'node:os'
import { runProcess } from '../../../shared/child-process/run-process'
import { windowsPowerShellPath } from '../../../shared/child-process/windows-system-binary'
import { getSystemCliInstallDirectories } from '../../../shared/system-cli-install-dirs'
import { resolveCommandOnLocalPath } from '../../ipc/command-path-resolver'
import { buildLocalPreflightEnv } from '../../ipc/preflight-local-env'
import { runWslProcess } from '../../wsl/wsl-runner'
import {
  HostProgramHostError,
  type HostExecutor,
  type HostPlatform,
  type RunResult,
  type WhichResult
} from './host-program-types'

const WHICH_TIMEOUT_MS = 15_000
const SAFE_COMMAND = /^[A-Za-z0-9._-]+$/
// Why: a missing program is data (not installed), never an exception.
const NOT_FOUND = /executable file not found|no such file or directory|not found/i

function hostPlatform(): HostPlatform {
  return process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux'
}

async function resolveLocal(command: string): Promise<string | null> {
  const env = buildLocalPreflightEnv() ?? process.env
  const onPath = await resolveCommandOnLocalPath(command, { env })
  if (onPath || process.platform === 'win32') {
    return onPath
  }
  // Why: a GUI launch can carry a PATH without ~/.local/bin, where native installers put their commands.
  const installDirs = getSystemCliInstallDirectories(process.platform, homedir())
  return resolveCommandOnLocalPath(command, { env: { PATH: installDirs.join(delimiter) } })
}

/** This computer. Commands run through the shared process runner, never a shell string. */
export function createLocalHostExecutor(): HostExecutor {
  const platform = hostPlatform()
  const run = async (argv: readonly string[], timeoutMs: number): Promise<RunResult> => {
    const [command = '', ...args] = argv
    const program = await resolveLocal(command)
    if (!program) {
      return {
        code: null,
        stdout: '',
        stderr: `${command}: not found`,
        timedOut: false,
        missing: true
      }
    }
    const result = await runProcess({
      program,
      args,
      env: buildLocalPreflightEnv(),
      timeoutMs
    })
    return {
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut
    }
  }
  return {
    platform,
    which: async (command): Promise<WhichResult> => {
      const path = await resolveLocal(command)
      return path ? { state: 'found', path } : { state: 'absent' }
    },
    run,
    script: async (script, timeoutMs) => {
      const result = await runProcess({
        program: platform === 'win32' ? windowsPowerShellPath() : '/bin/sh',
        args:
          platform === 'win32'
            ? ['-NoProfile', '-NonInteractive', '-Command', script]
            : ['-c', script],
        env: buildLocalPreflightEnv(),
        timeoutMs
      })
      return {
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut
      }
    }
  }
}

/** One WSL distro, run with `wsl.exe --exec` so no Windows shell touches the command. */
export function createWslHostExecutor(distro: string): HostExecutor {
  if (process.platform !== 'win32') {
    throw new HostProgramHostError('unsupported', 'WSL distros exist only on Windows.')
  }
  const toResult = (result: Awaited<ReturnType<typeof runWslProcess>>): RunResult => ({
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: result.timedOut,
    ...(result.code !== 0 && NOT_FOUND.test(result.stderr) ? { missing: true } : {})
  })
  return {
    platform: 'linux',
    which: async (command): Promise<WhichResult> => {
      if (!SAFE_COMMAND.test(command)) {
        return { state: 'absent' }
      }
      const result = await runWslProcess({
        distro,
        script: 'command -v -- "$1"',
        args: [command],
        loginPath: 'preferred',
        timeoutMs: WHICH_TIMEOUT_MS
      })
      if (result.timedOut) {
        return { state: 'unverifiable' }
      }
      const path = result.stdout.trim().split('\n')[0] ?? ''
      // Why: WSL appends the Windows PATH, so /mnt/ hits are this computer's programs, not the distro's.
      return result.code === 0 && path && !path.startsWith('/mnt/')
        ? { state: 'found', path }
        : { state: 'absent' }
    },
    run: async (argv, timeoutMs) => {
      const [program = '', ...args] = argv
      return toResult(
        await runWslProcess({ distro, program, args, loginPath: 'preferred', timeoutMs })
      )
    },
    script: async (script, timeoutMs) =>
      toResult(await runWslProcess({ distro, script, loginPath: 'preferred', timeoutMs }))
  }
}
