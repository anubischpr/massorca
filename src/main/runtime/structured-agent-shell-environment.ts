import { resolveLoginShellEnvironment } from '../startup/login-shell-environment'
import {
  nativeChatShellEnvironmentPolicy,
  type NativeChatShellEnvironmentPolicy
} from '../../shared/native-chat-shell-environment'

// Why: with the whole shell off, the child must still find its CLI and keep locale and agent socket.
const BASELINE_SHELL_VARIABLES = ['PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SSH_AUTH_SOCK']

function definedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const defined: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      defined[key] = value
    }
  }
  return defined
}

/** Overlays shell variables on Orca's env; win32 names are case-insensitive, so drop the base spelling. */
function overlayShellVariables(
  base: Record<string, string>,
  shellVariables: Record<string, string>,
  platform: NodeJS.Platform
): Record<string, string> {
  const merged = { ...base }
  if (platform === 'win32') {
    const overlaid = new Set(Object.keys(shellVariables).map((key) => key.toUpperCase()))
    for (const key of Object.keys(merged)) {
      if (overlaid.has(key.toUpperCase())) {
        delete merged[key]
      }
    }
  }
  return { ...merged, ...shellVariables }
}

// Why: version-manager shims (mise, asdf, volta, nvm, pyenv) resolve their tools through these
// variables; a login shell that does not export them leaves a shim on PATH that cannot run.
const TOOL_MANAGER_VARIABLE = /^(?:MISE_|ASDF_)|^(?:VOLTA_HOME|NVM_DIR|PYENV_ROOT)$/

function findEnvKey(
  env: Record<string, string>,
  name: string,
  platform: NodeJS.Platform
): string | undefined {
  return Object.keys(env).find((key) => (platform === 'win32' ? key.toUpperCase() : key) === name)
}

/**
 * Keeps what the login shell did not say: process PATH entries it lacks join after its own, and
 * tool-manager variables it does not set come from the process. A value the shell sets always wins.
 */
function withProcessToolchain(
  env: Record<string, string>,
  processEnv: Record<string, string>,
  platform: NodeJS.Platform
): Record<string, string> {
  const merged = { ...env }
  const processPathKey = findEnvKey(processEnv, 'PATH', platform)
  if (processPathKey !== undefined) {
    const pathKey = findEnvKey(merged, 'PATH', platform) ?? processPathKey
    const separator = platform === 'win32' ? ';' : ':'
    const keyOf = (segment: string): string =>
      platform === 'win32' ? segment.toLowerCase() : segment
    const segments = (merged[pathKey] ?? '').split(separator).filter(Boolean)
    const present = new Set(segments.map(keyOf))
    for (const segment of processEnv[processPathKey].split(separator).filter(Boolean)) {
      if (!present.has(keyOf(segment))) {
        present.add(keyOf(segment))
        segments.push(segment)
      }
    }
    merged[pathKey] = segments.join(separator)
  }
  for (const [key, value] of Object.entries(processEnv)) {
    if (TOOL_MANAGER_VARIABLE.test(platform === 'win32' ? key.toUpperCase() : key)) {
      const existing = findEnvKey(merged, platform === 'win32' ? key.toUpperCase() : key, platform)
      if (existing === undefined) {
        merged[key] = value
      }
    }
  }
  return merged
}

function pickShellVariables(
  shellEnv: NodeJS.ProcessEnv,
  names: readonly string[],
  platform: NodeJS.Platform
): Record<string, string> {
  const normalize = (key: string): string => (platform === 'win32' ? key.toUpperCase() : key)
  const allowed = new Set([...BASELINE_SHELL_VARIABLES, ...names].map(normalize))
  const picked: Record<string, string> = {}
  for (const [key, value] of Object.entries(definedEnv(shellEnv))) {
    if (allowed.has(normalize(key))) {
      picked[key] = value
    }
  }
  return picked
}

/**
 * The env every structured chat child starts from, before its provider pins an account.
 * Inheriting everything is the login-shell snapshot as-is; otherwise Orca's own env plus
 * the baseline and listed shell variables.
 */
export function structuredAgentBaseEnvironment(input: {
  shellEnv: NodeJS.ProcessEnv
  policy: NativeChatShellEnvironmentPolicy
  processEnv?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
}): Record<string, string> {
  const platform = input.platform ?? process.platform
  const processEnv = definedEnv(input.processEnv ?? process.env)
  if (input.policy.inheritAll) {
    return withProcessToolchain(definedEnv(input.shellEnv), processEnv, platform)
  }
  return withProcessToolchain(
    overlayShellVariables(
      processEnv,
      pickShellVariables(input.shellEnv, input.policy.names, platform),
      platform
    ),
    processEnv,
    platform
  )
}

export type StructuredAgentEnvironmentSources = {
  resolveEnvironment?: () => Promise<NodeJS.ProcessEnv>
  resolveShellEnvironmentPolicy?: () => NativeChatShellEnvironmentPolicy
  resolveLaunchEnv?: () => Promise<NodeJS.ProcessEnv>
  resolveLaunchEnvOverlay?: () => Promise<Record<string, string>> | Record<string, string>
  resolveCodexOverrides?: () => NodeJS.ProcessEnv
  /** Test seam; production reads the process env. */
  processEnv?: NodeJS.ProcessEnv
}

/**
 * Both providers' child envs over one login-shell snapshot, taken once at install.
 * The policy and overlays are re-read per acquisition, so a settings change reaches
 * the next chat without a restart.
 */
export function createStructuredAgentEnvironmentResolvers(
  sources: StructuredAgentEnvironmentSources
): {
  resolveCodexEnvironment: () => Promise<NodeJS.ProcessEnv>
  resolveClaudeInheritedEnv: () => Promise<Record<string, string>>
  /** The shared base every agent's child env starts from, before its own overlay. */
  resolveBaseEnvironment: () => Promise<Record<string, string>>
} {
  const shellEnvironment = (sources.resolveEnvironment ?? resolveLoginShellEnvironment)()
  const resolveBase = async (): Promise<Record<string, string>> =>
    structuredAgentBaseEnvironment({
      shellEnv: await shellEnvironment,
      policy: sources.resolveShellEnvironmentPolicy?.() ?? nativeChatShellEnvironmentPolicy(null),
      ...(sources.processEnv ? { processEnv: sources.processEnv } : {})
    })
  return {
    resolveCodexEnvironment: async () => ({
      ...(await resolveBase()),
      ...(await sources.resolveLaunchEnv?.()),
      ...(await sources.resolveLaunchEnvOverlay?.()),
      ...sources.resolveCodexOverrides?.()
    }),
    resolveClaudeInheritedEnv: resolveBase,
    resolveBaseEnvironment: resolveBase
  }
}
