import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { release } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import {
  agentSessionAccountHomesEqual,
  isAgentSessionAccountHome,
  type AgentSessionAccountHome,
  type AntigravityAgentSessionAccountHome
} from '../../shared/agent-session-account-home'
import { AgentSessionPreSpawnError } from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import {
  readAntigravityFileIdentity,
  verifyAntigravityFileAuthority
} from './file-credential-authority'
import type { AntigravityAccountService } from './native-account-service'

type BindingDeps = {
  hostEnv: NodeJS.ProcessEnv
  hostHome: string
  platform: NodeJS.Platform
  kernelRelease: string
  readIdentity: (home: string) => ReturnType<AntigravityAccountService['readIdentity']>
  readModelProvider: (home: string) => unknown
  verifyAuthority?: typeof verifyAntigravityFileAuthority
}

function readModelProvider(home: string): unknown {
  const file = join(home, '.gemini', 'antigravity-cli', 'settings.json')
  if (!existsSync(file)) {
    return undefined
  }
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.size > 512 * 1024) {
    throw new Error('Antigravity authentication settings cannot be read safely.')
  }
  const settings: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Antigravity authentication settings are invalid.')
  }
  return 'modelProvider' in settings ? settings.modelProvider : undefined
}

/** Read on the executing host, under the same environment its supervised child will receive. */
export async function readAntigravityAccountBinding(
  input: { launchEnv: NodeJS.ProcessEnv; previous?: AgentSessionAccountHome },
  deps: BindingDeps = {
    hostEnv: process.env,
    hostHome: getAppEnvironment().getPath('home'),
    platform: process.platform,
    kernelRelease: release(),
    readIdentity: readAntigravityFileIdentity,
    readModelProvider
  }
): Promise<AntigravityAgentSessionAccountHome> {
  const home = input.launchEnv.HOME ?? input.launchEnv.USERPROFILE
  if (!home || !isAbsolute(home) || resolve(home) !== resolve(deps.hostHome)) {
    throw new AgentSessionPreSpawnError(
      new Error('Antigravity launch changed its credential home.'),
      {
        reason: 'managedAccountEnvOverride'
      }
    )
  }
  let identity
  try {
    const verify = deps.verifyAuthority ?? verifyAntigravityFileAuthority
    const authority = async () => {
      if (resolve(deps.hostEnv.HOME ?? deps.hostEnv.USERPROFILE ?? '') !== resolve(home)) {
        throw new Error('Antigravity host changed credential home.')
      }
      const host = await verify(deps.hostEnv, deps.platform, deps.kernelRelease)
      const child = await verify(input.launchEnv, deps.platform, deps.kernelRelease)
      if (host !== child) {
        throw new Error('Antigravity launch changed credential authority.')
      }
      return host
    }
    const before = await authority()
    const provider = deps.readModelProvider(home)
    if (provider !== undefined && provider !== '') {
      throw new Error(
        'Antigravity alternate model-provider authentication cannot be bound to a Google account.'
      )
    }
    identity = await deps.readIdentity(home)
    const confirmed = await deps.readIdentity(home)
    if (
      (await authority()) !== before ||
      JSON.stringify(identity) !== JSON.stringify(confirmed) ||
      (input.launchEnv.HOME ?? input.launchEnv.USERPROFILE) !== home ||
      deps.readModelProvider(home) !== provider
    ) {
      throw new Error('Antigravity credential authority changed during acquisition.')
    }
  } catch {
    throw new AgentSessionPreSpawnError(
      new Error('Antigravity credential authority could not be verified.'),
      {
        reason: 'managedAccountUnsupported'
      }
    )
  }
  if (!identity || identity.authMethod !== 'consumer') {
    throw new AgentSessionPreSpawnError(
      new Error('Antigravity has no supported stable Google account identity.'),
      {
        reason: 'managedAccountUnsupported'
      }
    )
  }
  const binding: AntigravityAgentSessionAccountHome = {
    kind: 'antigravity',
    locator: { home: resolve(home), credentialStore: 'file', ...identity }
  }
  if (!isAgentSessionAccountHome(binding)) {
    throw new AgentSessionPreSpawnError(new Error('Antigravity account identity is invalid.'), {
      reason: 'managedAccountUnsupported'
    })
  }
  if (input.previous && !agentSessionAccountHomesEqual(input.previous, binding)) {
    throw new AgentSessionPreSpawnError(
      new Error('Antigravity conversation belongs to another account or credential authority.'),
      {
        reason: 'historyInOtherAccount'
      }
    )
  }
  return binding
}
