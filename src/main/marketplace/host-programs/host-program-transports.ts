import { getAppEnvironment } from '../../../shared/app-environment'
import { callRuntimeEnvironment } from '../../ipc/runtime-environment-transport-routing'
import { getActiveMultiplexer } from '../../ssh/ssh-target-registry'
import { setHostProgramTransports } from './host-program-router'
import type { SshExecReply } from './host-program-ssh-executor'

// Why: the relay's own exec adds nothing to the timeout, so the request waits a little longer than the step.
const TRANSPORT_MARGIN_MS = 15_000

/** Connects the host-program router to the desktop's SSH connections and paired-host client. */
export function installHostProgramTransports(): void {
  setHostProgramTransports({
    ssh: async (connectionId, payload): Promise<SshExecReply | null> => {
      const mux = getActiveMultiplexer(connectionId)
      if (!mux || mux.isDisposed()) {
        return null
      }
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: agent.execNonInteractive answers { stdout, stderr, exitCode, timedOut, spawnError? } (relay agent-exec-handler ExecResult).
      return (await mux.request(
        'agent.execNonInteractive',
        { ...payload, cwd: '', stdin: null, shell: true },
        { timeoutMs: payload.timeoutMs + TRANSPORT_MARGIN_MS }
      )) as SshExecReply
    },
    runtime: async (environmentId, method, params, timeoutMs) => {
      const response = await callRuntimeEnvironment(
        getAppEnvironment().getPath('userData'),
        environmentId,
        method,
        params,
        timeoutMs
      )
      return response.ok === true
        ? { ok: true, result: response.result }
        : { ok: false, failureCode: response.error.code }
    }
  })
}
