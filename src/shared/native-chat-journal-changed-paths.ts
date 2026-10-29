import type {
  AgentJournalRenderItem,
  AgentJournalToolCallItem
} from './agent-session-journal-types'
import { isFileWriteToolName } from './native-chat-edit-normalize'
import { editedPathsFromToolPair, isPathOnlyMutationToolName } from './native-chat-edit-paths'
import { toolFilePath } from './native-chat-tool-summary'
import { isPrototypeArtifactPath } from './prototype-artifact-paths'

function toolCallPaths(body: AgentJournalToolCallItem, input: unknown): string[] {
  return editedPathsFromToolPair({
    name: body.name,
    input,
    state: body.state,
    ...(body.output
      ? { result: { output: body.output.head, isError: body.state === 'failed' } }
      : {})
  }).filter((path) => path !== 'file' || toolFilePath(body.input) === 'file')
}

/** Every path the journal records as changed, oldest touch first: what the Results list shows. It
 *  reads any tool's input for the shapes agents report an edit in, so it is a display list and not
 *  evidence of a write; see `writtenFilePathsFromJournalItems`. Prototype files are left out: the
 *  Prototypes view owns them. */
export function changedFilePathsFromJournalItems(
  items: readonly AgentJournalRenderItem[]
): string[] {
  return items
    .flatMap(({ body }) => {
      if (body.kind === 'diff') {
        return [body.path]
      }
      return body.kind === 'tool-call' ? toolCallPaths(body, body.input) : []
    })
    .filter((path) => !isPrototypeArtifactPath(path))
}

/** Paths a host may vouch for as the agent's own writes: provider diff items, and completed calls
 *  of the tools that write files. Another tool's input (an MCP tool, a read, a search) can carry
 *  any path and proves nothing, and only the patch tool's input may list files in `changes`. */
export function writtenFilePathsFromJournalItems(
  items: readonly AgentJournalRenderItem[]
): string[] {
  return items.flatMap(({ body }) => {
    if (body.kind === 'diff') {
      return [body.path]
    }
    if (
      body.kind !== 'tool-call' ||
      !(isFileWriteToolName(body.name) || isPathOnlyMutationToolName(body.name))
    ) {
      return []
    }
    const input =
      body.name !== 'apply_patch' && typeof body.input === 'object' && body.input !== null
        ? Object.fromEntries(Object.entries(body.input).filter(([key]) => key !== 'changes'))
        : body.input
    return toolCallPaths(body, input)
  })
}
