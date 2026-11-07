import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import type {
  ListPrototypeSetsResult,
  PrototypeListedSet
} from '../../shared/rpc-contract/prototype-params'

function formatSet(set: PrototypeListedSet): string {
  const title = set.title ?? set.chatTitle ?? 'Untitled set'
  const archived = set.archived === true ? '  archived' : ''
  return `${title}  request ${set.requestId}  chat ${set.sessionId}  ${set.agent}${archived}`
}

function formatSets(result: ListPrototypeSetsResult): string {
  if (result.sets.length === 0) {
    return 'No prototype sets.'
  }
  return result.sets.map(formatSet).join('\n')
}

export const PROTOTYPES_HANDLERS: Record<string, CommandHandler> = {
  'prototypes list': async (ctx) => {
    // Why: an empty or valueless --worktree must fail, not widen silently to every set.
    const worktreeId = ctx.flags.has('worktree')
      ? getRequiredStringFlag(ctx.flags, 'worktree')
      : undefined
    const result = await ctx.client.call<ListPrototypeSetsResult>(
      'prototypes.list',
      worktreeId === undefined ? {} : { worktreeId }
    )
    printResult(result, ctx.json, formatSets)
  }
}
