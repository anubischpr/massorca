import type { UnvalidatedRpcRequestPort } from '../transport/unvalidated-rpc-request-port'
import { repoInitGitRead } from './folder-repo-git-init-operations'

export type FolderRepoGitInitOutcome = { ok: true } | { ok: false; message: string }

const FALLBACK_MESSAGE = 'Could not initialize Git.'

/** Asks the repo's host to run `git init`. Never throws: every failure becomes a message. */
export async function initFolderRepoGit(
  client: UnvalidatedRpcRequestPort,
  repoId: string
): Promise<FolderRepoGitInitOutcome> {
  try {
    const result = repoInitGitRead.interpret(
      await repoInitGitRead.request(client, { repo: repoId })
    )
    if (result.ok) {
      return { ok: true }
    }
    // Why: git's own text is the useful part; the code is only the fallback.
    return { ok: false, message: result.message || result.error }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : FALLBACK_MESSAGE
    }
  }
}
