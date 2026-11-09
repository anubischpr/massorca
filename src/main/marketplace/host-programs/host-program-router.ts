import type { MarketplaceHostProgramParamsValue } from '../../../shared/rpc-contract/marketplace-host-program-params'
import { createLocalHostExecutor, createWslHostExecutor } from './host-program-executors'
import { createSshHostExecutor, type SshExecTransport } from './host-program-ssh-executor'
import { HostProgramHostError, type HostExecutor } from './host-program-types'

/** One call to a paired runtime host; `failureCode` is the host's RPC error code when it refused. */
export type HostProgramRuntimeForward = (
  environmentId: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number
) => Promise<{ ok: true; result: unknown } | { ok: false; failureCode?: string }>

export type HostProgramFailure = {
  ok: false
  reason: 'unsupported' | 'unreachable' | 'host-needs-update' | 'failed'
  message: string
}

// Why injected: the desktop owns the SSH connections and the paired-host client, and electron stays out of the RPC graph.
let sshTransport: SshExecTransport | null = null
let runtimeForward: HostProgramRuntimeForward | null = null

export function setHostProgramTransports(next: {
  ssh: SshExecTransport | null
  runtime: HostProgramRuntimeForward | null
}): void {
  sshTransport = next.ssh
  runtimeForward = next.runtime
}

function hostFailure(error: unknown): HostProgramFailure {
  if (error instanceof HostProgramHostError) {
    return { ok: false, reason: error.reason, message: error.message }
  }
  return { ok: false, reason: 'failed', message: 'The host did not answer as expected.' }
}

async function executorFor(host: string): Promise<HostExecutor> {
  if (host.startsWith('wsl:')) {
    return createWslHostExecutor(host.slice('wsl:'.length))
  }
  if (host.startsWith('ssh:')) {
    if (!sshTransport) {
      throw new HostProgramHostError('unsupported', 'This host cannot reach SSH hosts.')
    }
    return createSshHostExecutor(host.slice('ssh:'.length), sshTransport)
  }
  return createLocalHostExecutor()
}

const STATUS_TIMEOUT_MS = 90_000
// Why: matches the install step cap, plus the version checks around it.
const ACTION_TIMEOUT_MS = 25 * 60_000

/**
 * Runs one program action on the host named in `params`. A paired runtime host gets the same call
 * with no host, so it answers for itself; every other host is driven from here.
 */
export async function dispatchHostProgram<T extends { ok: boolean }>(
  method: string,
  params: MarketplaceHostProgramParamsValue,
  run: (exec: HostExecutor) => Promise<T>,
  read: (answer: unknown) => T
): Promise<T | HostProgramFailure> {
  const host = params.host ?? 'local'
  try {
    if (host.startsWith('runtime:')) {
      if (!runtimeForward) {
        return {
          ok: false,
          reason: 'unsupported',
          message: 'This host cannot reach paired servers.'
        }
      }
      const answer = await runtimeForward(
        host.slice('runtime:'.length),
        method,
        { program: params.program },
        method.endsWith('.status') ? STATUS_TIMEOUT_MS : ACTION_TIMEOUT_MS
      )
      if (answer.ok) {
        return read(answer.result)
      }
      // Why: an older host answers method_not_found; a phone scope without the method answers forbidden.
      const needsUpdate =
        answer.failureCode === 'method_not_found' || answer.failureCode === 'forbidden'
      return needsUpdate
        ? { ok: false, reason: 'host-needs-update', message: 'Update MassOrca on that host first.' }
        : { ok: false, reason: 'unreachable', message: 'The paired server did not answer.' }
    }
    return await run(await executorFor(host))
  } catch (error) {
    return hostFailure(error)
  }
}
