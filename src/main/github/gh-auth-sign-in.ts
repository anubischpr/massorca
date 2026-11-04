/**
 * In-app GitHub sign-in through `gh auth login --web` (device flow).
 *
 * Why: gh keeps the token in its own credential store; this module reads only
 * the one-time code and the verification URL from gh's output and reports them.
 * The renderer opens the URL, so nothing here launches a browser.
 */
import type {
  GhSignInEvent,
  GhSignInFailureReason,
  GhSignInState
} from '../../preload/api/github-account-api'
import { runProcess, spawnProcess } from '../../shared/child-process/run-process'
import type {
  ProcessResult,
  ProcessSpec,
  SpawnedProcess
} from '../../shared/child-process/process-spec'
import { forceTerminateProcessTree } from '../../shared/child-process/process-tree-termination'
import { resolveCommand } from '../git/command-runner/wsl-command-resolution'
import { diagnoseGhAuth } from './auth-diagnose'
import { invalidateGhMultiAccountCapability } from './gh-capability-state'
import { invalidateGhAccountTokenCache, stripAmbientGhTokenEnv } from './gh-account-token'

export const GH_SIGN_IN_EVENT_CHANNEL = 'gh:signInEvent'
export const GH_SIGN_IN_TIMEOUT_MS = 10 * 60_000
const DEFAULT_SIGN_IN_HOST = 'github.com'
const HELP_PROBE_TIMEOUT_MS = 10_000
// oxlint-disable-next-line no-control-regex -- SAFETY: matches the ESC introducer of gh's ANSI color codes.
const ANSI_ESCAPE = /\u001b\[[0-9;?]*[A-Za-z]/g

export type GhSignInEmit = (event: GhSignInEvent) => void
export type GhSignInStartArgs = { signInId: string; host: string }

export type GhSignInDeps = {
  /** Resolves argv to the program and arguments to spawn, through the shared gh binary resolution. */
  resolveGh: (args: string[]) => { program: string; args: string[] }
  spawn: (spec: ProcessSpec) => ReturnType<typeof spawnProcess>
  run: (spec: ProcessSpec) => Promise<ProcessResult>
  killTree: (child: SpawnedProcess) => Promise<boolean>
  env: () => NodeJS.ProcessEnv
  timeoutMs: number
  /** Runs after a successful sign-in, before `done` is emitted, so the accounts list reads fresh state. */
  onSignedIn: () => void
  /** Used only when gh's output does not name the new login. */
  lookupActiveUser: (host: string) => Promise<string | null>
}

type SignInSession = {
  signInId: string
  emit: GhSignInEmit
  /** Kept per session so a replaced sign-in kills its own child with the deps it started with. */
  killTree: GhSignInDeps['killTree']
  child: SpawnedProcess | null
  settled: boolean
  timer: ReturnType<typeof setTimeout> | null
}

let activeSession: SignInSession | null = null

const defaultDeps: GhSignInDeps = {
  resolveGh: (args) => {
    const resolved = resolveCommand('gh', args, undefined)
    return { program: resolved.binary, args: resolved.args }
  },
  spawn: spawnProcess,
  run: (spec) => runProcess(spec),
  killTree: (child) => forceTerminateProcessTree(child),
  env: () => ({ ...stripAmbientGhTokenEnv(process.env), NO_COLOR: '1' }),
  timeoutMs: GH_SIGN_IN_TIMEOUT_MS,
  onSignedIn: () => {
    // Why: a new login changes which token a bound call resolves, so drop cached tokens and capability probes.
    invalidateGhAccountTokenCache()
    invalidateGhMultiAccountCapability()
  },
  lookupActiveUser: async (host) => {
    const diagnostic = await diagnoseGhAuth(host)
    return diagnostic.accounts.find((a) => a.host === host && a.active)?.user ?? null
  }
}

/** Validates the IPC payload; returns null for anything the sign-in must not run with. */
export function readGhSignInStartArgs(value: unknown): GhSignInStartArgs | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const signInId = 'signInId' in value ? value.signInId : undefined
  const host = 'host' in value ? value.host : undefined
  if (typeof signInId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(signInId)) {
    return null
  }
  const normalizedHost = typeof host === 'string' ? host.trim().toLowerCase() : DEFAULT_SIGN_IN_HOST
  return isValidGhSignInHost(normalizedHost) ? { signInId, host: normalizedHost } : null
}

/** A bare hostname (github.com or a GHES host); a leading dash or a port is refused. */
export function isValidGhSignInHost(host: string): boolean {
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(
    host
  )
}

export function parseGhSignInCode(output: string): string | null {
  const match = stripAnsi(output).match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})\b/i)
  return match ? match[1].toUpperCase() : null
}

/**
 * Takes a device-flow URL printed by gh, accepting only one on the sign-in host,
 * so gh output can never point the renderer at another site.
 */
export function parseGhSignInVerificationUrl(output: string, host: string): string | null {
  for (const match of stripAnsi(output).matchAll(/https?:\/\/[^\s'"<>)\]]+/g)) {
    try {
      const url = new URL(match[0].replace(/[.,;:]+$/, ''))
      if (url.hostname.toLowerCase() === host && url.pathname.startsWith('/login/device')) {
        return url.toString()
      }
    } catch {
      // Why: a malformed URL in gh output is skipped, never reported.
    }
  }
  return null
}

export function parseGhSignInUser(output: string): string | null {
  const match = stripAnsi(output).match(/Logged in as\s+([A-Za-z0-9][A-Za-z0-9_-]*)/)
  return match ? match[1] : null
}

/** Starts a sign-in and returns at once; progress arrives through `emit`. A newer start replaces the active one. */
export function startGhSignIn(
  args: GhSignInStartArgs,
  emit: GhSignInEmit,
  deps: GhSignInDeps = defaultDeps
): { ok: true } | { ok: false; reason: 'invalid_host' } {
  if (!isValidGhSignInHost(args.host)) {
    return { ok: false, reason: 'invalid_host' }
  }
  if (activeSession) {
    stopSession(activeSession, 'cancelled')
  }
  const session: SignInSession = {
    signInId: args.signInId,
    emit,
    killTree: deps.killTree,
    child: null,
    settled: false,
    timer: null
  }
  activeSession = session
  session.timer = setTimeout(() => stopSession(session, 'timeout'), deps.timeoutMs)
  void runSignIn(session, args.host, deps)
  return { ok: true }
}

/** Cancels the sign-in with this id and kills its gh process tree; a no-op once it settled. */
export function cancelGhSignIn(signInId: string): void {
  if (activeSession?.signInId === signInId) {
    stopSession(activeSession, 'cancelled')
  }
}

function stopSession(session: SignInSession, reason: GhSignInFailureReason): void {
  if (session.settled) {
    return
  }
  settle(session, { kind: 'failed', reason })
  if (session.child) {
    void session.killTree(session.child)
  }
}

function settle(session: SignInSession, state: GhSignInState): void {
  if (session.settled) {
    return
  }
  session.settled = true
  if (session.timer) {
    clearTimeout(session.timer)
    session.timer = null
  }
  if (activeSession === session) {
    activeSession = null
  }
  session.emit({ signInId: session.signInId, state })
}

async function runSignIn(session: SignInSession, host: string, deps: GhSignInDeps): Promise<void> {
  const skipSshKey = await supportsSkipSshKey(deps)
  if (session.settled) {
    return
  }
  // Why: the device flow runs unattended; --web skips the method prompt and --git-protocol https skips the protocol prompt.
  const argv = [
    'auth',
    'login',
    '--hostname',
    host,
    '--web',
    '--git-protocol',
    'https',
    ...(skipSshKey ? ['--skip-ssh-key'] : [])
  ]
  let output = ''
  let codeEmitted = false
  const onOutput = (chunk: Buffer | string): void => {
    output += chunk.toString()
    if (codeEmitted || session.settled) {
      return
    }
    const userCode = parseGhSignInCode(output)
    if (userCode) {
      codeEmitted = true
      const verificationUrl =
        parseGhSignInVerificationUrl(output, host) ?? `https://${host}/login/device`
      session.emit({
        signInId: session.signInId,
        state: { kind: 'code', userCode, verificationUrl }
      })
    }
  }
  try {
    const resolved = deps.resolveGh(argv)
    const child = deps.spawn({
      program: resolved.program,
      args: resolved.args,
      env: deps.env()
    })
    session.child = child
    child.stdout.on('data', onOutput)
    child.stderr.on('data', onOutput)
    child.on('error', () => settle(session, { kind: 'failed', reason: 'unavailable' }))
    child.on('close', (code) => {
      if (session.settled) {
        return
      }
      if (code !== 0) {
        settle(session, { kind: 'failed', reason: 'failed' })
        return
      }
      void finishSuccess(session, host, output, deps)
    })
  } catch {
    settle(session, { kind: 'failed', reason: 'unavailable' })
  }
}

async function finishSuccess(
  session: SignInSession,
  host: string,
  output: string,
  deps: GhSignInDeps
): Promise<void> {
  const user = parseGhSignInUser(output) ?? (await deps.lookupActiveUser(host).catch(() => null))
  if (session.settled) {
    return
  }
  deps.onSignedIn()
  settle(session, { kind: 'done', user })
}

/** `--skip-ssh-key` exists only in newer gh releases, so it is passed only when the installed gh lists it. */
async function supportsSkipSshKey(deps: GhSignInDeps): Promise<boolean> {
  try {
    const resolved = deps.resolveGh(['auth', 'login', '--help'])
    const result = await deps.run({
      program: resolved.program,
      args: resolved.args,
      env: deps.env(),
      timeoutMs: HELP_PROBE_TIMEOUT_MS
    })
    return `${result.stdout}\n${result.stderr}`.includes('--skip-ssh-key')
  } catch {
    return false
  }
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, '')
}
