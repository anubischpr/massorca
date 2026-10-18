import type { AgentSessionRegisteredAgent } from '../../../shared/agent-session-registered-agents'
import { LOCAL_EXECUTION_HOST_ID, toRuntimeExecutionHostId } from '../../../shared/execution-host'
import { lastVerifiedRuntimeStatus } from '../../../shared/runtime-host-status'
import { useAppStore } from '@/store'
import { readHostStructuredAgentsForRuntime } from './host-structured-agents'
import type { RuntimeClientTarget } from './runtime-client-target'

/** The agent's record as the host listed it, read outside React; undefined until it has. */
export function readHostStructuredAgent(
  target: RuntimeClientTarget,
  agent: string
): AgentSessionRegisteredAgent | undefined {
  if (target.kind !== 'environment') {
    return readHostStructuredAgentsForRuntime(LOCAL_EXECUTION_HOST_ID, null)?.find(
      (row) => row.agent === agent
    )
  }
  const runtimeId = lastVerifiedRuntimeStatus(
    useAppStore.getState().runtimeStatusByEnvironmentId.get(target.environmentId)
  )?.runtimeId
  return readHostStructuredAgentsForRuntime(
    toRuntimeExecutionHostId(target.environmentId),
    runtimeId ?? null
  )?.find((row) => row.agent === agent)
}

/** `piRuntime` when the host declares its own access for that runtime, else undefined: a host that
 *  predates the declaration still treats every Pi runtime as full access only. */
export function accessRuntimeDeclaredByHost(
  target: RuntimeClientTarget,
  agent: string,
  piRuntime: string | undefined
): string | undefined {
  return piRuntime &&
    readHostStructuredAgent(target, agent)?.capabilities.runtimeAccess?.[piRuntime]
    ? piRuntime
    : undefined
}
