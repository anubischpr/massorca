import type { JevDecisionsStatus } from '../../../shared/jev-decisions-status'
import type { RuntimeClientTarget } from './runtime-client-target'
import { callRuntimeRpc } from './runtime-rpc-client'

const RPC_OPTIONS = { timeoutMs: 30_000 }

export function getJevDecisionsStatus(target: RuntimeClientTarget): Promise<JevDecisionsStatus> {
  return target.kind === 'environment'
    ? callRuntimeRpc<JevDecisionsStatus>(target, 'jevDecisions.getStatus', undefined, RPC_OPTIONS)
    : window.api.jevDecisions.getStatus()
}

export function saveJevApiKey(
  target: RuntimeClientTarget,
  apiKey: string
): Promise<JevDecisionsStatus> {
  return target.kind === 'environment'
    ? callRuntimeRpc<JevDecisionsStatus>(
        target,
        'jevDecisions.saveApiKey',
        { apiKey: apiKey.trim() },
        RPC_OPTIONS
      )
    : window.api.jevDecisions.saveApiKey(apiKey)
}

export function clearJevApiKey(target: RuntimeClientTarget): Promise<JevDecisionsStatus> {
  return target.kind === 'environment'
    ? callRuntimeRpc<JevDecisionsStatus>(target, 'jevDecisions.clearApiKey', undefined, RPC_OPTIONS)
    : window.api.jevDecisions.clearApiKey()
}

/** A connected server's switch; this window's own switch is an ordinary setting. */
export function setRemoteJevDecisionsEnabled(
  target: Extract<RuntimeClientTarget, { kind: 'environment' }>,
  enabled: boolean
): Promise<JevDecisionsStatus> {
  return callRuntimeRpc<JevDecisionsStatus>(
    target,
    'jevDecisions.setEnabled',
    { enabled },
    RPC_OPTIONS
  )
}
