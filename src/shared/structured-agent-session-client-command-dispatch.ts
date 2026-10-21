import type { StructuredAgentSessionCommandOutcome } from './structured-agent-session-composer'

/** What the chat does itself for a `/name` it answers from state it holds, rather than sending it to the agent. */
export type StructuredAgentSessionClientCommandSurface = {
  /** `/status`: appends the chat's status row. */
  status?: () => boolean
  /** `/context`: expands the Context section of the summary rail. */
  context?: () => boolean
  /** `/permissions`: opens the access-mode picker; false when the chat has none. */
  permissions?: () => Promise<boolean>
  /** `/copy`: copies the newest answer; false when there is none. */
  copy?: () => Promise<boolean>
  /** `/export`: copies the chat as Markdown; false when there is nothing to export. */
  export?: () => Promise<boolean>
  /** `/mention`: inserts `@` and the query at the caret and opens the file picker. */
  mention?: (query: string) => boolean
  /** `/open`: the same surface as `/mention`, under the name agy uses. */
  open?: (query: string) => boolean
  /** `/rename`: renames the chat's tab to the name, or starts the inline rename when null. */
  rename?: (name: string | null) => boolean
}

const FAILURE_MESSAGE = {
  status: 'Could not show the chat status.',
  context: 'Could not open the Context section.',
  permissions: 'Access mode is unavailable for this chat session.',
  copy: 'There is no reply to copy yet.',
  export: 'There is no conversation to export yet.',
  mention: 'Could not open the file picker.',
  open: 'Could not open the file picker.',
  rename: 'Could not rename this chat.'
} as const

function refused(error: string): StructuredAgentSessionCommandOutcome {
  return { handled: true, accepted: false, error }
}

function answered(accepted: boolean, failure: string): StructuredAgentSessionCommandOutcome {
  return { handled: true, accepted, error: accepted ? null : failure }
}

/** Answers `/name` when this chat answers it itself; null leaves it to the next handler. */
export async function dispatchStructuredAgentSessionClientCommand(
  command: { name: string; argument: string },
  surface: StructuredAgentSessionClientCommandSurface
): Promise<StructuredAgentSessionCommandOutcome | null> {
  const { name, argument } = command
  switch (name) {
    case 'status':
    case 'context':
    case 'permissions':
    case 'copy':
    case 'export': {
      const run = surface[name]
      if (!run) {
        return null
      }
      if (argument !== '') {
        return refused(`Use /${name} without arguments.`)
      }
      return answered(await run(), FAILURE_MESSAGE[name])
    }
    case 'mention':
    case 'open': {
      const run = surface[name]
      return run ? answered(run(argument), FAILURE_MESSAGE[name]) : null
    }
    case 'rename': {
      const run = surface.rename
      return run ? answered(run(argument === '' ? null : argument), FAILURE_MESSAGE.rename) : null
    }
    default:
      return null
  }
}
