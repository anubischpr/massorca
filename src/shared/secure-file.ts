import { randomBytes } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import {
  DEFAULT_HARDENING_CACHE_BOUNDS,
  SecurePathHardeningCache,
  type SecurePathHardeningCacheBounds
} from './secure-path-hardening-cache'
import {
  configureHardeningRetryBudget,
  mayAttemptHardening,
  recordHardeningOutcome
} from './secure-path-hardening-retry-budget'
import {
  bestEffortRestrictWindowsPath,
  isWindowsSyncAclLaneAvailable,
  resetSecureFileWindowsUserSidForTests,
  resolveWindowsUserSid,
  restrictWindowsPathSync
} from './secure-path-windows-acl'
import {
  getHardenedPathCacheEntry,
  hardenedPathCacheEntriesMatch,
  type HardenedPathCacheEntry
} from './secure-path-metadata-snapshot'

const UNSUPPORTED_DIRECTORY_FSYNC_CODES = new Set(['EINVAL', 'ENOTSUP', 'EOPNOTSUPP'])

// Why: a Windows harden spawns icacls up to four times, so cache idempotent re-hardens per process.
let hardenedPathsThisProcess = new SecurePathHardeningCache<HardenedPathCacheEntry>(
  DEFAULT_HARDENING_CACHE_BOUNDS
)

// Why: child writes constantly bump a dir's mtime, so cache dirs by path (not metadata) to avoid an icacls spawn every read (#4901).
// Limitation: a dir deleted+recreated in-process won't re-harden; fine since we never delete our secure dirs at runtime.
let hardenedDirectoryPathsThisProcess = new SecurePathHardeningCache<true>(
  DEFAULT_HARDENING_CACHE_BOUNDS
)

// Why: a file created inside a directory whose hardened DACL the async lane confirmed inherits only
// the allowed SIDs, so it is current-user-only from its first byte with no per-file icacls spawn.
let verifiedWindowsDirectoriesThisProcess = new SecurePathHardeningCache<true>(
  DEFAULT_HARDENING_CACHE_BOUNDS
)

/** Published files awaiting their async protected DACL; true when another write landed meanwhile. */
const publishedFileProtectInFlight = new Map<string, boolean>()

// Why opt-in: orcad and the CLI have no window to freeze and fail closed on an unrestricted write,
// so only the desktop UI process trades the blocking lane for the async one.
let nonBlockingWindowsWrites = false

function hardenSecureDirectoryOnce(dirPath: string): void {
  // Why: dir hardening stays async — re-applying it stormed the main thread (#4901).
  if (hardenedDirectoryPathsThisProcess.get(dirPath)) {
    return
  }
  // Cache before the ACL lands so concurrent writes don't restorm; a failure drops it, under the retry budget.
  hardenedDirectoryPathsThisProcess.set(dirPath, true)
  applySecurePathRestriction(dirPath, true, process.platform, false, (restricted) => {
    if (restricted) {
      verifiedWindowsDirectoriesThisProcess.set(dirPath, true)
    } else {
      hardenedDirectoryPathsThisProcess.delete(dirPath)
      verifiedWindowsDirectoriesThisProcess.delete(dirPath)
    }
  })
}

/**
 * For the desktop UI process: secure writes stop waiting on icacls/whoami, which froze every
 * window (pv85 "Not Responding"). Also starts the SID lookup and the directory verification off
 * the main thread, so the first write after launch already finds a verified directory.
 */
export function enableNonBlockingSecureFileWrites(directories: readonly string[]): void {
  if (process.platform !== 'win32') {
    return
  }
  nonBlockingWindowsWrites = true
  void resolveWindowsUserSid().then(() => {
    for (const dir of directories) {
      if (existsSync(dir)) {
        hardenSecureDirectoryOnce(dir)
      }
    }
  })
}

type StagedWindowsRestriction = 'protected' | 'inherited' | 'unrestricted'

/**
 * Restricts a staged Windows file without letting a slow host block the main thread:
 * - `inherited`: the parent's hardened DACL is verified, so the file already grants only the
 *   allowed SIDs; no spawn at all.
 * - `protected`: the sync icacls lane ran and verified a protected DACL on the staged file.
 * - `unrestricted`: neither held — the apply failed, or (non-blocking processes only) the SID is
 *   still resolving or a stalled icacls tripped the sync lane; the file carries whatever its parent
 *   grants until the async protect lands.
 */
function restrictStagedWindowsFile(dir: string, tmpFile: string): StagedWindowsRestriction {
  if (verifiedWindowsDirectoriesThisProcess.get(dir)) {
    return 'inherited'
  }
  if (nonBlockingWindowsWrites && !isWindowsSyncAclLaneAvailable()) {
    return 'unrestricted'
  }
  // Why no retry floor here: the write path is user-driven, not polled, and a failed apply
  // must still be retried on the next write of the same credential.
  return restrictWindowsPathSync(tmpFile, false) ? 'protected' : 'unrestricted'
}

/** Converts a published file to a protected DACL off-thread; overlapping writes coalesce into one rerun. */
function protectPublishedWindowsFile(targetPath: string): void {
  if (publishedFileProtectInFlight.has(targetPath)) {
    publishedFileProtectInFlight.set(targetPath, true)
    return
  }
  publishedFileProtectInFlight.set(targetPath, false)
  applySecurePathRestriction(targetPath, false, 'win32', false, (restricted) => {
    const rewritten = publishedFileProtectInFlight.get(targetPath) === true
    publishedFileProtectInFlight.delete(targetPath)
    if (rewritten) {
      protectPublishedWindowsFile(targetPath)
    } else if (restricted) {
      rememberHardenedPath(targetPath, false)
    }
  })
}

function hardenSecurePathOnce(targetPath: string, isDirectory: boolean): boolean {
  if (isDirectory && process.platform === 'win32') {
    hardenSecureDirectoryOnce(targetPath)
    return true
  }

  const currentEntry = getHardenedPathCacheEntry(targetPath, isDirectory)
  if (!currentEntry) {
    hardenedPathsThisProcess.delete(targetPath)
  }
  const cachedEntry = hardenedPathsThisProcess.get(targetPath)
  if (currentEntry && cachedEntry && hardenedPathCacheEntriesMatch(currentEntry, cachedEntry)) {
    return true
  }
  // Why: async re-harden is safe here — read path hardens each file at most once/process; new files harden synchronously on the write path.
  const outcome = applySecurePathRestriction(
    targetPath,
    isDirectory,
    process.platform,
    false,
    (restricted) => {
      if (!restricted) {
        hardenedPathsThisProcess.delete(targetPath)
      }
    }
  )
  if (outcome !== 'failed') {
    rememberHardenedPath(targetPath, isDirectory)
    return true
  }
  return false
}

/** Returns false when the file was written but its permissions could not be restricted. */
export function writeSecureJsonFile(targetPath: string, value: unknown): boolean {
  return writeSecureFile(targetPath, JSON.stringify(value, null, 2))
}

/** Returns false when the file was written but its permissions could not be restricted. */
export function writeDurableSecureJsonFile(targetPath: string, value: unknown): boolean {
  return writeSecureFile(targetPath, JSON.stringify(value, null, 2), { durable: true })
}

/**
 * Writes `contents` and restricts the result to the current user.
 *
 * Returns whether the restriction actually took. Hardening stays best-effort — it fails
 * legitimately on FAT32, network paths and restricted tokens, and must not break a write — but
 * the outcome is now reported rather than assumed, so a caller storing a credential can react.
 *
 * The return value covers the *file* only. The parent directory is hardened fire-and-forget — on
 * Windows that lane is async and answers `pending` regardless — so a `true` here says nothing
 * about the directory's ACL.
 *
 * On Windows this never spawns once the parent directory is verified, and never after a stalled
 * icacls tripped the sync lane: icacls/whoami on the main thread froze every window (pv85).
 */
export function writeSecureFile(
  targetPath: string,
  contents: string,
  options: { durable?: boolean } = {}
): boolean {
  const dir = dirname(targetPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  // Windows dir hardening stays async + path-cached (it stormed the main thread, #4901); POSIX keeps the metadata cache to catch chmod/ctime drift.
  hardenSecurePathOnce(dir, true)

  const tmpFile = `${targetPath}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`
  try {
    writeFileSync(tmpFile, contents, {
      encoding: 'utf-8',
      mode: 0o600
    })
    if (options.durable) {
      fsyncFileSync(tmpFile)
    }
    // Why before the rename: writeFileSync mode is a no-op on Windows, so the staged file must
    // already be restricted when the rename publishes it.
    const staged: StagedWindowsRestriction =
      process.platform === 'win32'
        ? restrictStagedWindowsFile(dir, tmpFile)
        : applySecurePathRestriction(tmpFile, false, process.platform, true) === 'applied'
          ? 'protected'
          : 'unrestricted'
    // A same-volume rename keeps the staged file's DACL, so the published file needs no second pass.
    renameSync(tmpFile, targetPath)
    if (staged === 'protected') {
      // Cache only on confirmed success so failures retry; a success also clears the read path's backoff.
      rememberHardenedPath(targetPath, false)
      recordHardeningOutcome(targetPath, true)
    } else if (process.platform === 'win32') {
      protectPublishedWindowsFile(targetPath)
    }
    if (options.durable) {
      bestEffortFsyncDirectorySync(dir)
    }
    return staged !== 'unrestricted'
  } catch (error) {
    rmSync(tmpFile, { force: true })
    throw error
  }
}

function fsyncPathSync(path: string, flags: 'r' | 'r+'): void {
  const descriptor = openSync(path, flags)
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

export function fsyncFileSync(path: string): void {
  // FlushFileBuffers requires a write-capable handle on Windows.
  fsyncPathSync(path, process.platform === 'win32' ? 'r+' : 'r')
}

export function bestEffortFsyncDirectorySync(directory: string): void {
  if (process.platform === 'win32') {
    return
  }
  try {
    fsyncPathSync(directory, 'r')
  } catch (error) {
    if (
      error instanceof Error &&
      UNSUPPORTED_DIRECTORY_FSYNC_CODES.has((error as NodeJS.ErrnoException).code ?? '')
    ) {
      return
    }
    throw error
  }
}

/**
 * Errors that mean the contents were never seen, so they say nothing about what the file holds.
 *
 * `ENOENT` is deliberately absent: "there is no file" genuinely licenses creating one. So is a
 * parse failure, which means the bytes WERE read and were garbage - the self-heal these stores
 * were built for. The distinction is "could not read it" versus "read it and it was garbage".
 *
 * Why it matters: a reader that treats every failure as corruption regenerates the file, and the
 * regeneration succeeds - `renameSync` over an unreadable file needs `FILE_DELETE_CHILD` on the
 * parent, not `DELETE` on the file - so the original is destroyed by the code meant to heal it.
 * `EPERM`/`EACCES` is the hardened-DACL case: a file granting a SID this process does not hold,
 * reachable through a relocated user-data path, a share or roaming profile, a restored backup
 * under a new local SID, or a half-applied harden. The rest are transient and, on Windows, more
 * likely than that: `EBUSY` is what antivirus produces by holding a file open at the moment of a
 * read, which for a credential read on the startup path is an ordinary Tuesday.
 */
export function isUnreadableError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code
  return (
    code === 'EPERM' ||
    code === 'EACCES' ||
    code === 'EBUSY' ||
    code === 'EMFILE' ||
    code === 'ENFILE' ||
    code === 'EIO'
  )
}

export function hardenExistingSecureFile(targetPath: string): void {
  const dir = dirname(targetPath)
  if (existsSync(dir)) {
    hardenSecurePathOnce(dir, true)
  }
  if (existsSync(targetPath)) {
    hardenSecurePathOnce(targetPath, false)
  }
}

/** Applies the platform-appropriate permission restriction to a path once, bypassing the cache. */
export function hardenSecurePath(
  targetPath: string,
  options: {
    isDirectory: boolean
    platform: NodeJS.Platform
    sync?: boolean
  }
): void {
  applySecurePathRestriction(
    targetPath,
    options.isDirectory,
    options.platform,
    options.sync ?? false
  )
}

/**
 * `pending` is the honest answer for the async Windows branch: it has not happened yet, and
 * reporting it as `applied` is what let a dead ACL look like a working one. The real outcome
 * arrives through `onAsyncSettled`.
 */
type HardeningOutcome = 'applied' | 'pending' | 'failed'

function applySecurePathRestriction(
  targetPath: string,
  isDirectory: boolean,
  platform: NodeJS.Platform,
  sync: boolean,
  onAsyncSettled?: (restricted: boolean) => void
): HardeningOutcome {
  if (platform === 'win32') {
    // Explicit sync callers keep blocking: their files rely on the restriction landing first.
    if (sync) {
      // Why no retry floor here: the write path is user-driven, not polled, and a failed apply
      // must still be retried on the next write of the same credential.
      // Why: apply the ACL synchronously so the credential file isn't briefly readable under inherited ACLs (writeFileSync mode is a no-op on Windows).
      const restricted = restrictWindowsPathSync(targetPath, isDirectory)
      if (restricted) {
        // Success only: this is how a recovered host clears the read path's backoff (and reports
        // `recovered`). Recording a failure here would put the exempt lane back under the budget.
        recordHardeningOutcome(targetPath, true)
      }
      return restricted ? 'applied' : 'failed'
    }
    // Why the floor: this is the read path, polled at ~2/s (#4901). Retrying every failure there
    // is the same storm the cache exists to prevent.
    if (!mayAttemptHardening(targetPath)) {
      onAsyncSettled?.(false)
      return 'failed'
    }
    // Why: dir/read-path re-harden runs async to avoid blocking the main thread (#4901).
    bestEffortRestrictWindowsPath(targetPath, isDirectory, (restricted) => {
      recordHardeningOutcome(targetPath, restricted)
      onAsyncSettled?.(restricted)
    })
    return 'pending'
  }
  chmodSync(targetPath, isDirectory ? 0o700 : 0o600)
  return 'applied'
}

/** Caches the current metadata snapshot for a just-hardened path, or clears it if the path is gone. */
function rememberHardenedPath(targetPath: string, isDirectory: boolean): void {
  const entry = getHardenedPathCacheEntry(targetPath, isDirectory)
  if (entry) {
    hardenedPathsThisProcess.set(targetPath, entry)
  } else {
    hardenedPathsThisProcess.delete(targetPath)
  }
}

export function __resetSecureFileWindowsUserSidForTests(): void {
  resetSecureFileWindowsUserSidForTests()
}

export function __resetSecureFileHardenedPathsForTests(
  bounds: SecurePathHardeningCacheBounds = DEFAULT_HARDENING_CACHE_BOUNDS
): void {
  hardenedPathsThisProcess = new SecurePathHardeningCache(bounds)
  hardenedDirectoryPathsThisProcess = new SecurePathHardeningCache(bounds)
  verifiedWindowsDirectoriesThisProcess = new SecurePathHardeningCache(bounds)
  publishedFileProtectInFlight.clear()
  nonBlockingWindowsWrites = false
  configureHardeningRetryBudget(bounds)
}

export function __getSecureFileHardeningCacheStateForTests(): {
  paths: ReturnType<SecurePathHardeningCache<HardenedPathCacheEntry>['state']>
  directories: ReturnType<SecurePathHardeningCache<true>['state']>
} {
  return {
    paths: hardenedPathsThisProcess.state(),
    directories: hardenedDirectoryPathsThisProcess.state()
  }
}
