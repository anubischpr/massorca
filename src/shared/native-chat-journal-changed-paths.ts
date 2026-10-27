import type { AgentJournalRenderItem } from './agent-session-journal-types'
import { editedPathsFromToolPair } from './native-chat-edit-paths'
import { toolFilePath } from './native-chat-tool-summary'

/** Every path the journal records as changed, oldest touch first. The Results list and the host's
 *  recorded-file read both derive from this, so what a chat shows is exactly what the host serves. */
export function changedFilePathsFromJournalItems(
  items: readonly AgentJournalRenderItem[]
): string[] {
  return items.flatMap(({ body }) => {
    if (body.kind === 'diff') {
      return [body.path]
    }
    if (body.kind !== 'tool-call') {
      return []
    }
    return editedPathsFromToolPair({
      name: body.name,
      input: body.input,
      state: body.state,
      ...(body.output
        ? { result: { output: body.output.head, isError: body.state === 'failed' } }
        : {})
    }).filter((path) => path !== 'file' || toolFilePath(body.input) === 'file')
  })
}
