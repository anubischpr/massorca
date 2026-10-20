import { resolveAgentSessionFullAccess } from '../../shared/agent-session-access-mode'
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
import {
  isStableCliVersionOnLine,
  probeAgentCliVersionOutcome,
  type AgentCliVersionProbeOutcome
} from '../agent-cli-version-probe'
import { ANTIGRAVITY_STABLE_CLI_FLOOR } from '../../shared/antigravity-cli-version-floor'
import {
  AgentSessionPreSpawnError,
  type AgentSessionPreSpawnReason
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import { structuredPassthroughLaunchArgs } from '../native-chat/structured-agent-passthrough-launch-args'
import { antigravityModelIdAtEffort } from '../../shared/antigravity-model-variants'
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
  /** The user's saved Arguments tokens for agy, re-read per acquisition. */
  resolveLaunchArgs?: () => Promise<string[]> | string[]
  readBinding?: typeof readAntigravityAccountBinding
  prepareAccount?: typeof prepareAntigravityAccountForLaunch
  probeVersion?: typeof probeAgentCliVersionOutcome
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

/** Whether the agy CLI ran and is a supported version, or why it could not run here. */
export function antigravityCliVersionOutcome(
  launch: { command: string; cwd: string; env: Record<string, string> },
  probe = probeAgentCliVersionOutcome
): Promise<AgentCliVersionProbeOutcome> {
  return probe({ program: launch.command, cwd: launch.cwd, env: launch.env }, (version) =>
    isStableCliVersionOnLine(version, { major: 1, floor: ANTIGRAVITY_STABLE_CLI_FLOOR })
  )
}

/** The reason a chat names when its agy CLI cannot run: missing, or ran without reporting a supported
 *  version (outdated, failed, timed out, or printed none); the copy names all of those. */
export function antigravityCliUnavailableReason(
  outcome: Exclude<AgentCliVersionProbeOutcome, 'supported'>
): AgentSessionPreSpawnReason {
  return outcome === 'did-not-start' ? 'cliMissing' : 'antigravityCliVersionUnsupported'
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
    const outcome = await antigravityCliVersionOutcome({ command, cwd, env }, deps.probeVersion)
    if (outcome !== 'supported') {
      throw new AgentSessionPreSpawnError(undefined, {
        reason: antigravityCliUnavailableReason(outcome),
        message: `agy did not run as a stable ${ANTIGRAVITY_STABLE_CLI_FLOOR}+ CLI (${outcome})`
      })
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
    const savedArgs = antigravitySavedLaunchArgs((await deps.resolveLaunchArgs?.()) ?? [], options)
    return {
      command,
      cwd,
      env,
      previous,
      args: [
        ...savedArgs,
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        ...(previous ? ['--conversation', previous.handle.nativeId] : []),
        ...(options.model
          ? ['--model', antigravityModelIdAtEffort(options.model, options.effort)]
          : []),
        ...(options.effort ? ['--effort', options.effort] : []),
        ...antigravityAccessArgs(record.options?.accessMode, deps.resolveFullAccess?.() === true)
      ]
    }
  }
}

/** Transport, session and permission options the structured launch sets itself. */
const ANTIGRAVITY_OWNED_VALUE_FLAGS = [
  '--input-format',
  '--output-format',
  '--conversation',
  '--mode'
]
const ANTIGRAVITY_OWNED_SWITCHES = [
  '--dangerously-skip-permissions',
  '--print',
  '-p',
  '--continue',
  '-c',
  '--resume',
  '-r',
  '--help',
  '-h',
  '--version',
  '-v'
]

/** Saved Arguments minus what Orca owns; a model or effort the chat picked beats the saved one. */
function antigravitySavedLaunchArgs(
  tokens: readonly string[],
  options: Readonly<Record<string, string>>
): string[] {
  return structuredPassthroughLaunchArgs('Antigravity', tokens, {
    valueFlags: new Set([
      ...ANTIGRAVITY_OWNED_VALUE_FLAGS,
      ...(options.model ? ['--model', '-m'] : []),
      ...(options.effort ? ['--effort'] : [])
    ]),
    switches: new Set(ANTIGRAVITY_OWNED_SWITCHES)
  })
}

const ANTIGRAVITY_MODE_FLAGS = {
  auto: 'auto',
  'accept-edits': 'accept-edits',
  plan: 'plan'
} as const

/** `--mode` for a preset (agy 1.3.5: accept-edits, auto, plan), the skip flag for full access, and
 *  nothing for the CLI's own approving default. */
export function antigravityAccessArgs(
  accessMode: string | undefined,
  inheritedFullAccess: boolean
): string[] {
  if (accessMode === 'auto' || accessMode === 'accept-edits' || accessMode === 'plan') {
    return ['--mode', ANTIGRAVITY_MODE_FLAGS[accessMode]]
  }
  return resolveAgentSessionFullAccess(accessMode, inheritedFullAccess)
    ? ['--dangerously-skip-permissions']
    : []
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
