import type { AgentSessionExecutionLocation } from '../../shared/agent-session-record'
import type { StructuredAgentId } from '../../shared/agent-session-provider-handle'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { nativeChatShellEnvironmentPolicy } from '../../shared/native-chat-shell-environment'
import { isTuiAgent } from '../../shared/tui-agent-config'
import {
  resolveTuiAgentLaunchEnv,
  resolvedTuiAgentArgsBypassPermissions
} from '../../shared/tui-agent-launch-defaults'
import type { ClaudeManagedAccountGateSettings } from '../native-chat/claude-structured-managed-account-support'
import {
  resolveStructuredAgentSessionCreateSupport,
  warnStructuredAgentSessionCreateUnsupported,
  type StructuredAgentSessionCreateSupport
} from '../native-chat/structured-agent-session-create-support'
import { resolveLoginShellEnvironment } from '../startup/login-shell-environment'
import { structuredAgentRuntimeRegistration } from './structured-agent-runtime-registrations'
import type { AgentSessionPreSpawnReason } from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import { structuredAgentBaseEnvironment } from './structured-agent-shell-environment'
import {
  piRuntimeCommandSettings,
  type PiRuntimeSelection
} from '../../shared/pi-runtime-selection'

type LaunchEnvironmentSettings = Pick<
  GlobalSettings,
  'agentDefaultEnv' | 'nativeChatInheritShellEnvironment' | 'nativeChatShellEnvironmentVariables'
> &
  Partial<Pick<GlobalSettings, 'agentCmdOverrides' | 'agentDefaultArgs' | 'terminalWindowsShell'>>

export function resolvedPiChatAccessMode(
  settings: LaunchEnvironmentSettings,
  requested?: 'default' | 'full-access'
) {
  return (
    requested ??
    (resolvedTuiAgentArgsBypassPermissions('pi', settings, process.platform)
      ? 'full-access'
      : 'default')
  )
}

/** The environment every agent's launch on this host starts from, for a check made before the
 *  session host is built. */
async function resolveHostStructuredAgentBaseEnvironment(
  settings: LaunchEnvironmentSettings
): Promise<Record<string, string>> {
  return structuredAgentBaseEnvironment({
    shellEnv: await resolveLoginShellEnvironment(),
    policy: nativeChatShellEnvironmentPolicy(settings)
  })
}

/** What the check reads from the runtime asking it. */
type LaunchSupportRuntime = {
  requireStore(): { getSettings(): LaunchEnvironmentSettings }
  resolveRuntimeFileTarget(selector: string): Promise<{ worktree: { path: string } }>
}

/** The agent's own check of what is installed on this host, with the environment and Command
 *  setting its launch starts from, in the workspace it would launch in; true for an agent whose
 *  location alone decides. */
export async function structuredAgentSupportsLaunch(
  agent: string,
  worktreeSelector: string,
  runtime: LaunchSupportRuntime,
  piRuntime?: PiRuntimeSelection,
  candidate?: boolean
): Promise<boolean | AgentSessionPreSpawnReason> {
  const supportsLaunch = structuredAgentRuntimeRegistration(agent)?.supportsLaunch
  if (!supportsLaunch) {
    return true
  }
  const settings = runtime.requireStore().getSettings()
  const env = {
    ...(await resolveHostStructuredAgentBaseEnvironment(settings)),
    ...(isTuiAgent(agent) ? resolveTuiAgentLaunchEnv(agent, settings.agentDefaultEnv) : {})
  }
  const cwd = (await runtime.resolveRuntimeFileTarget(worktreeSelector)).worktree.path
  return supportsLaunch({
    cwd,
    env,
    commandSettings:
      agent === 'pi' ? piRuntimeCommandSettings(settings, piRuntime ?? 'pi') : settings,
    ...(candidate ? { candidate } : {})
  })
}

/** The Pi runtime a create with none named runs on this host: stock Pi when it can run, else Gentle
 *  Shell when that can. An explicit choice is never replaced. `launch` is the verdict for the
 *  chosen runtime; when neither is installed it says so, which is the one cause worth naming. */
async function resolveHostPiRuntime(input: {
  piRuntime?: PiRuntimeSelection
  worktreeSelector: string
  runtime: LaunchSupportRuntime
}): Promise<{ piRuntime?: PiRuntimeSelection; launch: boolean | AgentSessionPreSpawnReason }> {
  const stock = await structuredAgentSupportsLaunch(
    'pi',
    input.worktreeSelector,
    input.runtime,
    input.piRuntime
  )
  if (input.piRuntime !== undefined || stock === true) {
    return { ...(input.piRuntime ? { piRuntime: input.piRuntime } : {}), launch: stock }
  }
  const gentle = await structuredAgentSupportsLaunch(
    'pi',
    input.worktreeSelector,
    input.runtime,
    'gentle-shell',
    true
  )
  if (gentle === true) {
    return { piRuntime: 'gentle-shell', launch: true }
  }
  return { launch: stock === 'cliMissing' && gentle === 'cliMissing' ? 'cliMissing' : stock }
}

/** `agentSession.createSupport` on this host: every refusal it can know before spawning. The
 *  agent's location rule and installed-agent check from its registration, without installing the
 *  host, then Claude's managed-account gate. A refusal logs which check said no. A Pi request that
 *  names no runtime resolves to Gentle Shell when only that is installed, and the reply says so. */
export async function resolveHostStructuredAgentCreateSupport(input: {
  agent: StructuredAgentId
  piRuntime?: PiRuntimeSelection
  accessMode?: 'default' | 'full-access'
  worktreeSelector: string
  location: AgentSessionExecutionLocation
  runtime: LaunchSupportRuntime
  getSettings: () => ClaudeManagedAccountGateSettings
}): Promise<StructuredAgentSessionCreateSupport> {
  const { agent, location } = input
  const supportsLocation =
    structuredAgentRuntimeRegistration(agent)?.supportsLocation(location) ?? false
  let piRuntime = input.piRuntime
  let launch: boolean | AgentSessionPreSpawnReason = false
  if (supportsLocation) {
    if (agent === 'pi') {
      const resolved = await resolveHostPiRuntime(input)
      piRuntime = resolved.piRuntime
      launch = resolved.launch
    } else {
      launch = await structuredAgentSupportsLaunch(agent, input.worktreeSelector, input.runtime)
    }
  }
  // Why: only stock Pi lacks a restricted mode; Gentle Shell applies its own Normal mode.
  if (
    agent === 'pi' &&
    piRuntime !== 'gentle-shell' &&
    resolvedPiChatAccessMode(input.runtime.requireStore().getSettings(), input.accessMode) !==
      'full-access'
  ) {
    return { supported: false, reason: 'access' }
  }
  const supportsLaunch = launch === true
  const support = resolveStructuredAgentSessionCreateSupport({
    agent,
    location,
    adapterSupportsCreate: supportsLaunch,
    getSettings: input.getSettings
  })
  warnStructuredAgentSessionCreateUnsupported(
    agent,
    typeof launch === 'string' && !support.supported ? { ...support, cause: launch } : support,
    !supportsLocation ? 'location' : !supportsLaunch ? 'installed-agent' : 'managed-account'
  )
  if (!support.supported) {
    // Why: a CLI that cannot run here names its cause, so the chat says that rather than a bare decline.
    return typeof launch === 'string' ? { ...support, cause: launch } : support
  }
  // Why: only a fallback is reported; an explicit runtime is already what the caller holds.
  return agent === 'pi' && input.piRuntime === undefined && piRuntime
    ? { ...support, piRuntime }
    : support
}
