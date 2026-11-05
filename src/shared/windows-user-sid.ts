import { runProcess, runProcessSync } from './child-process/run-process'
import { windowsSystem32Binary } from './child-process/windows-system-binary'

/** The current user's SID from `whoami`, resolved off the calling thread unless a caller must block. */

const WINDOWS_SID_PATTERN = /^S-1-\d+(?:-\d+)+$/

let cachedWindowsUserSid: string | null = null
let sidLookupFailedAt: number | null = null
let sidLookupInFlight: Promise<string | null> | null = null
const SID_LOOKUP_RETRY_MS = 60_000

/**
 * Why monotonic and not `Date.now`: a backwards wall-clock step held this window open until the
 * clock caught up, and a failed lookup disables both ACL lanes until it reopens.
 */
const monotonicNowMs = (): number => performance.now()

export function peekCachedWindowsUserSid(): string | null {
  return cachedWindowsUserSid
}

/** The cached SID; a miss starts the async lookup so no caller ever waits on whoami. */
export function peekWindowsUserSid(): string | null {
  if (!cachedWindowsUserSid) {
    void resolveWindowsUserSid()
  }
  return cachedWindowsUserSid
}

/**
 * Only a well-formed SID is cached for the process lifetime. A failure is cached for a minute:
 * caching it forever let one transient `whoami` hiccup disable hardening until restart.
 */
export function resolveWindowsUserSid(): Promise<string | null> {
  if (cachedWindowsUserSid) {
    return Promise.resolve(cachedWindowsUserSid)
  }
  if (sidLookupInFlight) {
    return sidLookupInFlight
  }
  if (sidLookupFailedAt !== null && monotonicNowMs() - sidLookupFailedAt < SID_LOOKUP_RETRY_MS) {
    return Promise.resolve(null)
  }
  const lookup = lookupWindowsUserSid()
  sidLookupInFlight = lookup
  void lookup.finally(() => {
    if (sidLookupInFlight === lookup) {
      sidLookupInFlight = null
    }
  })
  return lookup
}

const WHOAMI_USER_SPEC = {
  args: ['/user', '/fo', 'csv', '/nh'],
  timeoutMs: 5000
}

async function lookupWindowsUserSid(): Promise<string | null> {
  try {
    const result = await runProcess({
      program: windowsSystem32Binary('whoami.exe'),
      ...WHOAMI_USER_SPEC
    })
    return recordSidLookup(result.code === 0 ? result.stdout : null)
  } catch {
    return recordSidLookup(null)
  }
}

/** For callers that must block (orcad); the desktop write path never reaches it. */
export function lookupWindowsUserSidSync(): string | null {
  if (sidLookupFailedAt !== null && monotonicNowMs() - sidLookupFailedAt < SID_LOOKUP_RETRY_MS) {
    return null
  }
  try {
    const result = runProcessSync({
      program: windowsSystem32Binary('whoami.exe'),
      ...WHOAMI_USER_SPEC
    })
    return recordSidLookup(result.code === 0 ? result.stdout : null)
  } catch {
    return recordSidLookup(null)
  }
}

function recordSidLookup(stdout: string | null): string | null {
  const candidate = stdout === null ? undefined : parseCsvLine(stdout.trim())[1]
  if (candidate && WINDOWS_SID_PATTERN.test(candidate)) {
    cachedWindowsUserSid = candidate
    sidLookupFailedAt = null
    return candidate
  }
  sidLookupFailedAt = monotonicNowMs()
  return null
}

function parseCsvLine(line: string): string[] {
  return line.split(/","/).map((part) => part.replace(/^"/, '').replace(/"$/, ''))
}

export function resetWindowsUserSidForTests(): void {
  cachedWindowsUserSid = null
  sidLookupFailedAt = null
  sidLookupInFlight = null
}
