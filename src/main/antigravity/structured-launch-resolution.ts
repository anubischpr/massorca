import { randomUUID } from 'node:crypto'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import {
  agentSessionProviderHandleChainHead,
  type AgentSessionProviderHandleLink
} from '../../shared/agent-session-provider-handle'
import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import type { ProviderProcessLaunch } from '../provider-process/provider-process-launch'
import type { AgentSessionRecordStore } from '../runtime/agent-session-record-store'
import {
  resolveStructuredAgentCommand,
  type StructuredAgentCommandSettings
} from '../native-chat/structured-agent-command-resolution'
import { isStableCliVersionOnLine, probeAgentCliVersion } from '../agent-cli-version-probe'
import { readAntigravityAccountBinding } from './structured-account-binding'
import { prepareAntigravityAccountForLaunch } from './native-account-launch'

export type AntigravityResolvedLaunch = ProviderProcessLaunch & {
  previous: AgentSessionProviderHandleLink | null
}
export type AntigravityLaunchDeps = {
  store: AgentSessionRecordStore
  resolveWorkspacePath: (id: string) => Promise<string>
  resolveEnvironment: () => Promise<NodeJS.ProcessEnv>
  resolveCommandSettings?: () => StructuredAgentCommandSettings
  resolveFullAccess?: () => boolean
  readBinding?: typeof readAntigravityAccountBinding
  prepareAccount?: typeof prepareAntigravityAccountForLaunch
  probeVersion?: typeof probeAgentCliVersion
}

export function resolveAntigravityCommand(
  env: NodeJS.ProcessEnv,
  settings: StructuredAgentCommandSettings = {}
): string {
  return resolveStructuredAgentCommand(
    'antigravity',
    settings,
    {
      pathEnv: env.PATH ?? env.Path ?? null,
      homePath: env.HOME ?? env.USERPROFILE
    },
    { command: 'agy' }
  )
}

export function antigravityStructuredVersionSupported(
  launch: { command: string; cwd: string; env: Record<string, string> },
  probe = probeAgentCliVersion
): Promise<boolean> {
  return probe({ program: launch.command, cwd: launch.cwd, env: launch.env }, (version) =>
    isStableCliVersionOnLine(version, { major: 1, floor: '1.3.5' })
  )
}

/** Resume only the pinned host conversation; never use the CLI's global continuation. */
export function createAntigravityLaunchResolver(deps: AntigravityLaunchDeps) {
  return async (
    identity: AgentSessionJournalIdentity,
    options: Readonly<Record<string, string>> = {}
  ): Promise<AntigravityResolvedLaunch> => {
    const record = deps.store.getRecord(identity.sessionId)
    if (
      !record ||
      record.provider !== 'antigravity' ||
      record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
      record.location.wslDistro !== null
    ) {
      throw new Error('Antigravity session does not belong to this execution host')
    }
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(await deps.resolveEnvironment())) {
      if (value !== undefined) {
        env[key] = value
      }
    }
    await (deps.prepareAccount ?? prepareAntigravityAccountForLaunch)({
      launchAgent: 'antigravity',
      env,
      envIsComplete: true
    })
    await (deps.readBinding ?? readAntigravityAccountBinding)({
      launchEnv: env,
      previous: record.accountHome
    })
    const cwd = await deps.resolveWorkspacePath(record.location.workspaceId)
    const command = resolveAntigravityCommand(env, deps.resolveCommandSettings?.())
    if (!(await antigravityStructuredVersionSupported({ command, cwd, env }, deps.probeVersion))) {
      throw new Error(
        'Antigravity structured chat requires stable CLI 1.3.5 or newer on the 1.x line'
      )
    }
    const previous = agentSessionProviderHandleChainHead(record.providerHandleChain)
    if (
      previous &&
      (previous.handle.transport !== 'antigravity-stream-json' ||
        previous.handle.agent !== 'antigravity')
    ) {
      throw new Error('Antigravity conversation handle is not a stream-json handle')
    }
    if (options.effort && !['low', 'medium', 'high'].includes(options.effort)) {
      throw new Error('Antigravity reasoning effort is unsupported')
    }
    return {
      command,
      cwd,
      env,
      previous,
      args: [
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        ...(previous ? ['--conversation', previous.handle.nativeId] : []),
        ...(options.model ? ['--model', options.model] : []),
        ...(options.effort ? ['--effort', options.effort] : []),
        ...(deps.resolveFullAccess?.() === true ? ['--dangerously-skip-permissions'] : [])
      ]
    }
  }
}

export function antigravityProviderLink(
  launch: AntigravityResolvedLaunch,
  id: string,
  fence: number
): AgentSessionProviderHandleLink {
  if (!id || (launch.previous && launch.previous.handle.nativeId !== id)) {
    throw new Error(
      'Antigravity initialized a different conversation from the pinned resume handle'
    )
  }
  return {
    linkId: randomUUID(),
    handle: { transport: 'antigravity-stream-json', agent: 'antigravity', nativeId: id },
    origin: launch.previous ? 'resumed' : 'created',
    mintedAtFence: fence,
    observedAt: Date.now()
  }
}
