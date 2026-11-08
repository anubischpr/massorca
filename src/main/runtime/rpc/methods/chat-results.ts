// `chat.results`: the environment URLs and changed files a chat's Results card lists, read by the
// chat's execution host from its own journal. Additive: an older host answers `method_not_found`.

import {
  ListChatResultsParams,
  type ListChatResultsResult
} from '../../../../shared/rpc-contract/chat-results-params'
import { environmentUrlsFromJournalItems } from '../../../../shared/native-chat-environment-urls'
import { changedFilePathsFromJournalItems } from '../../../../shared/native-chat-journal-changed-paths'
import { defineMethod } from '../core'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

const CHAT_RESULTS_PAGE_LIMIT = 500

function newestFirstUnique(paths: readonly string[]): string[] {
  return [...new Set(paths.toReversed())]
}

export const CHAT_RESULTS_METHODS = [
  defineMethod({
    name: 'chat.results',
    permission: 'workspace',
    params: ListChatResultsParams,
    handler: async (params, ctx): Promise<ListChatResultsResult> => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      const { page } = await host.history(
        { sessionId: params.sessionId, direction: 'tail', limit: CHAT_RESULTS_PAGE_LIMIT },
        'every-agent'
      )
      return {
        sessionId: params.sessionId,
        urls: environmentUrlsFromJournalItems(page.items),
        files: newestFirstUnique(changedFilePathsFromJournalItems(page.items)),
        hasOlder: page.hasOlder
      }
    }
  })
]
