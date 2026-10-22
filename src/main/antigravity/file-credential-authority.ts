import { statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import { removeChromiumDisabledSessionBus } from '../pty/chromium-session-bus-env'
import {
  createAntigravityFileCredentialBackend,
  isAntigravityFileStorageHost
} from './native-credential-backend'

type AuthorityDeps = {
  uid: number | undefined
  socketWitness: (path: string, uid: number) => string | null
  inventory: (path: string, env: NodeJS.ProcessEnv, method: string) => Promise<string>
}

function unsupported(): Error {
  return new Error('Antigravity file credential authority could not be verified.')
}

function socketWitness(path: string, uid: number): string | null {
  try {
    const stat = statSync(path)
    if (!stat.isSocket() || stat.uid !== uid) {
      throw unsupported()
    }
    return `${stat.dev}:${stat.ino}`
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw unsupported()
  }
}

async function inventory(path: string, env: NodeJS.ProcessEnv, method: string): Promise<string> {
  const result = await runProcess({
    program: '/usr/bin/busctl',
    args: [
      '--address',
      `unix:path=${path}`,
      '--no-pager',
      'call',
      'org.freedesktop.DBus',
      '/org/freedesktop/DBus',
      'org.freedesktop.DBus',
      method
    ],
    env,
    timeoutMs: 3_000,
    maxOutputBytes: 64 * 1024,
    killOnOutputLimit: true
  })
  if (result.code !== 0 || result.timedOut || result.outputTruncated) {
    throw unsupported()
  }
  return result.stdout.trim()
}

function secretServiceAbsent(output: string): boolean {
  // Accept only busctl's complete string-array grammar; malformed/truncated output is unknown.
  const match = /^as (\d+)((?: "[A-Za-z0-9_.:-]+")*)$/.exec(output)
  if (!match) {
    throw unsupported()
  }
  const names = [...match[2].matchAll(/"([A-Za-z0-9_.:-]+)"/g)].map((item) => item[1])
  if (names.length !== Number(match[1])) {
    throw unsupported()
  }
  return !names.includes('org.freedesktop.secrets')
}

/** Only a plain `unix:path=` session bus address names a bus this check can inventory. */
function sessionBusPathFromAddress(address: string): string {
  const match = /^unix:path=([^,;%=\0]+)$/.exec(address)
  if (!match || !posix.isAbsolute(match[1])) {
    throw unsupported()
  }
  return match[1]
}

function busPath(env: NodeJS.ProcessEnv, uid: number): string {
  if (env.DBUS_SESSION_BUS_ADDRESS) {
    return sessionBusPathFromAddress(env.DBUS_SESSION_BUS_ADDRESS)
  }
  const runtime = env.XDG_RUNTIME_DIR
  return runtime ? posix.join(posix.resolve(runtime), 'bus') : `/run/user/${uid}/bus`
}

/** agy 1.3.5 uses composite storage; an absent address variable alone does not bypass keyring. */
export async function verifyAntigravityFileAuthority(
  rawEnv: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  kernelRelease: string,
  deps: AuthorityDeps = { uid: process.getuid?.(), socketWitness, inventory }
): Promise<string> {
  if (platform === 'win32') {
    throw unsupported()
  }
  // Electron writes `disabled:` here when it started without a session bus; it is not a bus.
  const env = { ...rawEnv }
  removeChromiumDisabledSessionBus(env)
  if (isAntigravityFileStorageHost(env, kernelRelease)) {
    return 'direct-file'
  }
  if (platform !== 'linux' || deps.uid === undefined) {
    throw unsupported()
  }
  const runtime = env.XDG_RUNTIME_DIR
  if (runtime && !posix.isAbsolute(runtime)) {
    throw unsupported()
  }
  // Why: a bus address names the bus itself, so its inventory decides, not the runtime-dir guess.
  const path = busPath(env, deps.uid)
  if (/[,%=;\0]/.test(path)) {
    throw unsupported()
  }
  const before = deps.socketWitness(path, deps.uid)
  if (before === null) {
    return `no-bus:${path}`
  }
  // These methods query the bus daemon only: no activation, Secret Service calls, or Unlock.
  for (const method of ['ListNames', 'ListActivatableNames', 'ListNames']) {
    if (!secretServiceAbsent(await deps.inventory(path, env, method))) {
      throw unsupported()
    }
  }
  if (deps.socketWitness(path, deps.uid) !== before) {
    throw unsupported()
  }
  return `unavailable-secret-service:${path}:${before}`
}

export async function readAntigravityFileIdentity(home: string) {
  const credential = await createAntigravityFileCredentialBackend(
    join(home, '.gemini', 'antigravity-cli', 'antigravity-oauth-token')
  ).read()
  return credential?.identity
    ? {
        issuer: credential.identity.issuer,
        subject: credential.identity.subject,
        authMethod: credential.authMethod
      }
    : null
}
