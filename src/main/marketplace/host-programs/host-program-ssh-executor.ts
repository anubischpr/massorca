import {
  HostProgramHostError,
  type HostExecutor,
  type HostPlatform,
  type RunResult,
  type WhichResult
} from './host-program-types'

// Why: the relay caps one exec at five minutes, so a longer step would be cut off without a verdict.
const RELAY_EXEC_CAP_MS = 290_000
let callCounter = 0
const SAFE_COMMAND = /^[A-Za-z0-9._-]+$/

export type SshExecPayload = {
  binary: string
  args: string[]
  timeoutMs: number
  /** Names the call's own lane, so the relay does not cancel one lookup for the next. */
  operation: string
}
export type SshExecReply = {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  canceled?: boolean
  spawnError?: string
}

/** Runs one command on an SSH host through its relay; null when no live connection exists. */
export type SshExecTransport = (
  connectionId: string,
  payload: SshExecPayload
) => Promise<SshExecReply | null>

function toResult(reply: SshExecReply): RunResult {
  return {
    code: reply.exitCode,
    stdout: reply.stdout,
    stderr: reply.stderr,
    timedOut: reply.timedOut || reply.canceled === true,
    ...(reply.spawnError ? { missing: true } : {})
  }
}

/** An SSH host's own shell, reached through the relay. POSIX hosts only. */
export async function createSshHostExecutor(
  connectionId: string,
  transport: SshExecTransport
): Promise<HostExecutor> {
  const send = async (binary: string, args: string[], timeoutMs: number): Promise<RunResult> => {
    const reply = await transport(connectionId, {
      binary,
      args,
      timeoutMs: Math.min(timeoutMs, RELAY_EXEC_CAP_MS),
      operation: `host-program-${++callCounter}`
    })
    if (!reply) {
      throw new HostProgramHostError('unreachable', 'The SSH host is not connected.')
    }
    return toResult(reply)
  }
  const kernel = await send('uname', ['-s'], 15_000)
  const name = kernel.stdout.trim()
  const platform: HostPlatform | null =
    name === 'Darwin' ? 'darwin' : name === 'Linux' ? 'linux' : null
  if (!platform) {
    throw new HostProgramHostError('unsupported', 'Only Linux and macOS SSH hosts are supported.')
  }
  return {
    platform,
    which: async (command): Promise<WhichResult> => {
      if (!SAFE_COMMAND.test(command)) {
        return { state: 'absent' }
      }
      const result = await send('sh', ['-c', 'command -v -- "$1"', '--', command], 15_000)
      if (result.timedOut) {
        return { state: 'unverifiable' }
      }
      const path = result.stdout.trim().split('\n')[0] ?? ''
      return result.code === 0 && path ? { state: 'found', path } : { state: 'absent' }
    },
    run: (argv, timeoutMs) => {
      const [binary = '', ...args] = argv
      return send(binary, args, timeoutMs)
    },
    script: (script, timeoutMs) => send('sh', ['-c', script], timeoutMs)
  }
}
