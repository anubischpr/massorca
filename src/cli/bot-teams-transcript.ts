import type { HandlerContext } from './dispatch'

/** The newest rows of a session, enough to reach its last final answer. */
const TAIL_LIMIT = 50

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The text of an assistant message row, or null for any other row. */
function assistantTextOf(item: unknown): string | null {
  const body = isRecord(item) ? item.body : undefined
  if (!isRecord(body) || body.kind !== 'message' || body.role !== 'assistant') {
    return null
  }
  if (!Array.isArray(body.blocks)) {
    return null
  }
  const text = body.blocks
    .map((block: unknown) =>
      isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? block.text : ''
    )
    .join('')
    .trim()
  return text === '' ? null : text
}

/** The newest assistant text in an `agentSession.history` page, or null when the page has none. */
export function lastAssistantText(result: unknown): string | null {
  const page = isRecord(result) ? result.page : undefined
  const items = isRecord(page) ? page.items : undefined
  if (!Array.isArray(items)) {
    return null
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const text = assistantTextOf(items[index])
    if (text !== null) {
      return text
    }
  }
  return null
}

/** The final text a task's bot wrote in its session; null when there is no session or no text yet. */
export async function readFinalText(
  ctx: HandlerContext,
  sessionId: string | null
): Promise<string | null> {
  if (sessionId === null) {
    return null
  }
  const response = await ctx.client.call<unknown>('agentSession.history', {
    sessionId,
    direction: 'tail',
    limit: TAIL_LIMIT
  })
  return lastAssistantText(response.result)
}
