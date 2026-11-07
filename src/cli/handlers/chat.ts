import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import type { ListChatResultsResult } from '../../shared/rpc-contract/chat-results-params'

function formatResults(result: ListChatResultsResult): string {
  const lines = ['Environment URLs:']
  if (result.urls.length === 0) {
    lines.push('  none')
  }
  for (const entry of result.urls) {
    lines.push(`  ${entry.url}  ${entry.source}${entry.previous ? '  previous' : ''}`)
  }
  lines.push('Changed files:')
  lines.push(...(result.files.length === 0 ? ['  none'] : result.files.map((path) => `  ${path}`)))
  if (result.hasOlder) {
    lines.push('Older history was not read; results only it records are not listed.')
  }
  return lines.join('\n')
}

export const CHAT_HANDLERS: Record<string, CommandHandler> = {
  'chat results': async (ctx) => {
    const sessionId = getRequiredStringFlag(ctx.flags, 'session')
    const result = await ctx.client.call<ListChatResultsResult>('chat.results', { sessionId })
    printResult(result, ctx.json, formatResults)
  }
}
