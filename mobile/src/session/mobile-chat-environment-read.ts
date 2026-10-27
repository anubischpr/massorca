import { z } from 'zod'
import { salvagingArray } from '../../../src/shared/zod-salvage'
import {
  normalizeGhAccountBinding,
  type GhAccountBinding
} from '../../../src/shared/github/account-binding'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import type { RpcClient } from '../transport/rpc-client'
import { worktreeCatalogRead } from '../worktree/worktree-catalog-operations'
import {
  environmentWorktreeFromRow,
  type MobileChatEnvironmentWorktree
} from './mobile-chat-environment'

/** Each repo's id and the GitHub account it binds. A host from before the field answers null. */
const repoAccountListSchema = z
  .looseObject({
    repos: salvagingArray(z.looseObject({ id: z.string(), ghAccount: z.unknown() }))
  })
  .transform((reply) =>
    reply.repos.map((repo) => ({
      id: repo.id,
      ghAccount: normalizeGhAccountBinding(repo.ghAccount)
    }))
  )

/** repo.list for the Summary's GitHub tile. A refusal reads as no accounts, not as an empty host. */
export const chatRepoAccountListRead = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'chat-summary.repo-accounts-or-skip',
    method: 'repo.list',
    acceptance: 'success-result-or-skip',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('chat-summary-repo-accounts', repoAccountListSchema)
  })
)

export type MobileChatEnvironment = {
  worktree: MobileChatEnvironmentWorktree
  /** Null when the repo binds no account, or the host predates the field. */
  ghAccount: GhAccountBinding | null
}

/** The environment for one worktree from the two replies. Null when the catalog does not list it. */
export function environmentFromReplies(input: {
  worktreeId: string
  catalogRows: readonly unknown[]
  repos: readonly { id: string; ghAccount: GhAccountBinding | null }[] | null
}): MobileChatEnvironment | null {
  for (const row of input.catalogRows) {
    const worktree = environmentWorktreeFromRow(input.worktreeId, row)
    if (worktree) {
      const repo = input.repos?.find((entry) => entry.id === worktree.repoId)
      return { worktree, ghAccount: repo?.ghAccount ?? null }
    }
  }
  return null
}

/** Reads the worktree row and its repo's account. A refused read is a null part, never a throw; a
 *  transport failure rejects so the caller can say the host did not answer. */
export async function readMobileChatEnvironment(
  client: RpcClient,
  worktreeId: string
): Promise<MobileChatEnvironment | null> {
  const [catalogReply, repoReply] = await Promise.all([
    worktreeCatalogRead.request(client, { limit: 10000 }),
    chatRepoAccountListRead.request(client)
  ])
  const catalog = worktreeCatalogRead.interpret(catalogReply)
  const repos = chatRepoAccountListRead.interpret(repoReply)
  return environmentFromReplies({
    worktreeId,
    catalogRows: catalog.accepted ? (catalog.value.worktrees ?? []) : [],
    repos: repos.accepted ? repos.value : null
  })
}
