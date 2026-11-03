import { normalizeGhAccountBinding } from '../../shared/github/account-binding'
import type { GhActiveAccountSwitchResult } from '../../shared/github/auth-types'
import { ghExecFileAsync } from '../git/runner'
import { invalidateGhAccountTokenCache } from './gh-account-token'

type GhExec = (args: string[], options: { wslDistro?: string }) => Promise<unknown>

/** Makes a keyring login gh's active account on this host (`gh auth switch`, gh ≥ 2.40). */
export async function switchGhActiveAccount(
  account: unknown,
  options: { wslDistro?: string } = {},
  exec: GhExec = ghExecFileAsync
): Promise<GhActiveAccountSwitchResult> {
  const binding = normalizeGhAccountBinding(account)
  if (!binding) {
    return { ok: false, reason: 'invalid_account' }
  }
  try {
    await exec(['auth', 'switch', '--hostname', binding.host, '--user', binding.user], options)
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : ''
    // Why: older gh has no `auth switch`; only the reason crosses IPC, never gh's raw output.
    return {
      ok: false,
      reason: /unknown command|unknown flag/i.test(stderr) ? 'unsupported' : 'failed'
    }
  }
  invalidateGhAccountTokenCache()
  return { ok: true }
}
