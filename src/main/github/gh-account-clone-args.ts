/**
 * `git clone -c` argv that pins a new clone to a GitHub account before its first fetch.
 */
import { normalizeGhAccountBinding } from '../../shared/github/account-binding'
import {
  buildGhAccountCloneConfigArgs,
  isGitConfigSafeGhBinding
} from '../../shared/github/gh-account-git-config'

/** Empty when no account is requested; throws when a requested account cannot be pinned safely. */
export function ghAccountCloneConfigArgs(ghAccount: unknown): string[] {
  if (ghAccount == null) {
    return []
  }
  const binding = normalizeGhAccountBinding(ghAccount)
  if (!binding || !isGitConfigSafeGhBinding(binding)) {
    throw new Error('GitHub account for clone is invalid')
  }
  return buildGhAccountCloneConfigArgs(binding)
}
