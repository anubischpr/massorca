import { normalizeGhAccountBinding } from '../../shared/github/account-binding'
import { ghExecFileAsync } from '../git/runner'
import { invalidateGhAccountTokenCache } from './gh-account-token'

export type GhAccountRemoveResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_account' | 'unsupported' | 'failed' }

type GhExec = (args: string[], options: { wslDistro?: string }) => Promise<unknown>

/** Removes one keyring login from gh on this host (`gh auth logout`, gh ≥ 2.40); the token is not revoked. */
export async function removeGhAccount(
  account: unknown,
  options: { wslDistro?: string } = {},
  exec: GhExec = ghExecFileAsync
): Promise<GhAccountRemoveResult> {
  const binding = normalizeGhAccountBinding(account)
  if (!binding) {
    return { ok: false, reason: 'invalid_account' }
  }
  try {
    await exec(['auth', 'logout', '--hostname', binding.host, '--user', binding.user], options)
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : ''
    // Why: older gh has no per-account logout; only the reason crosses IPC, never gh's raw output.
    return {
      ok: false,
      reason: /unknown command|unknown flag/i.test(stderr) ? 'unsupported' : 'failed'
    }
  }
  invalidateGhAccountTokenCache()
  return { ok: true }
}
