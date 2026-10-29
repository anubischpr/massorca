import { z } from 'zod'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'

// Both arms are soft results: a refusal arrives as a successful reply with `ok: false`, so the
// caller reads `error` / `message` itself. Only a transport or decode failure throws.
const repoInitGitReplySchema = z.union([
  z.looseObject({ ok: z.literal(true) }),
  z.looseObject({
    ok: z.literal(false),
    error: z.string(),
    message: z.string().optional()
  })
])

/** Turns a folder project into a Git project on the host that owns its files. */
export const repoInitGitRead = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'repo.init-git',
    method: 'repo.initGit',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('repo-git-initialized', repoInitGitReplySchema)
  })
)
