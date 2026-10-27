// Why: sidebar rows and the chat environment card both show a repo's gh.account. One shared
// reading per repo and execution host keeps rows from re-running git config on every render,
// and a git config write invalidates it so the display follows the pin.

/** One repo on one execution host. `key` already encodes `repoId`. */
export type RepoGhAccountGitConfigSlot = { key: string; repoId: string }

/** Resolves to the login, `null` when gh.account is unset, or `undefined` when unreadable. */
export type RepoGhAccountGitConfigLoad = () => Promise<string | null | undefined>

type Slot = {
  repoId: string
  /** Last settled login. `null` means unset; kept when a later read is unreadable. */
  account: string | null | undefined
  status: 'idle' | 'loading' | 'loaded' | 'unknown'
  bindingSignature: string | null
  /** Set by invalidation: the next ensure reads again even for the same binding. */
  stale: boolean
  requestId: number
  load: RepoGhAccountGitConfigLoad | null
  listeners: Set<() => void>
}

const slots = new Map<string, Slot>()
// Why: module-wide, so a reply from a cleared cache can never match a newer request.
let lastRequestId = 0

function slotFor(slot: RepoGhAccountGitConfigSlot): Slot {
  const existing = slots.get(slot.key)
  if (existing) {
    return existing
  }
  const created: Slot = {
    repoId: slot.repoId,
    account: undefined,
    status: 'idle',
    bindingSignature: null,
    stale: false,
    requestId: 0,
    load: null,
    listeners: new Set()
  }
  slots.set(slot.key, created)
  return created
}

function notify(slot: Slot): void {
  for (const listener of slot.listeners) {
    listener()
  }
}

function settleRead(key: string, requestId: number, account: string | null | undefined): void {
  const slot = slots.get(key)
  // Why: a newer read (another binding, or an invalidation) supersedes this reply.
  if (!slot || slot.requestId !== requestId) {
    return
  }
  if (account === undefined) {
    slot.status = 'unknown'
    return
  }
  slot.status = 'loaded'
  if (slot.account !== account) {
    slot.account = account
    notify(slot)
  }
}

function startRead(
  key: string,
  slot: Slot,
  bindingSignature: string | null,
  load: RepoGhAccountGitConfigLoad
): void {
  lastRequestId += 1
  const requestId = lastRequestId
  slot.requestId = requestId
  slot.bindingSignature = bindingSignature
  slot.load = load
  slot.stale = false
  slot.status = 'loading'
  // Why: wrapping the call turns a synchronous throw from `load` into a rejection.
  new Promise<string | null | undefined>((resolve) => resolve(load())).then(
    (account) => settleRead(key, requestId, account),
    () => settleRead(key, requestId, undefined)
  )
}

/** Starts a read unless one for this binding is already in flight or settled. */
export function ensureRepoGhAccountGitConfig(
  slot: RepoGhAccountGitConfigSlot,
  bindingSignature: string | null,
  load: RepoGhAccountGitConfigLoad
): void {
  const current = slotFor(slot)
  const reusable =
    current.bindingSignature === bindingSignature &&
    !current.stale &&
    (current.status === 'loading' || current.status === 'loaded')
  if (!reusable) {
    startRead(slot.key, current, bindingSignature, load)
  }
}

export function subscribeRepoGhAccountGitConfig(
  slot: RepoGhAccountGitConfigSlot | null,
  listener: () => void
): () => void {
  if (!slot) {
    return () => undefined
  }
  const current = slotFor(slot)
  current.listeners.add(listener)
  return () => {
    current.listeners.delete(listener)
  }
}

/** The settled login, `null` when unset, or `undefined` while nothing has settled. */
export function getRepoGhAccountGitConfigAccount(
  slot: RepoGhAccountGitConfigSlot | null
): string | null | undefined {
  return slot ? slots.get(slot.key)?.account : undefined
}

/** Call after a git config write: readings may predate it, so mounted rows re-read now. */
export function invalidateRepoGhAccountGitConfig(repoId: string): void {
  for (const [key, slot] of slots) {
    if (slot.repoId !== repoId) {
      continue
    }
    slot.stale = true
    if (slot.load && slot.listeners.size > 0) {
      startRead(key, slot, slot.bindingSignature, slot.load)
    }
  }
}

export function clearRepoGhAccountGitConfigCache(): void {
  slots.clear()
}
