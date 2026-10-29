import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { durableWriteTempPath, writeFileDurable } from '../durable-file-write'
import { DELEGATION_AGENT_INSTRUCTIONS } from './delegation-agent-instructions'

const INSTRUCTIONS_FOLDER = 'delegation-instructions'

/**
 * An Orca-owned folder holding the child-session instructions as AGENTS.md, for an agent whose only
 * instruction channel is the rule files it finds in the folders it is given. Null when it cannot be
 * written: the chat then starts without the instructions.
 */
export async function ensureDelegationInstructionsFolder(
  stateDirectory: string
): Promise<string | null> {
  const folder = join(stateDirectory, INSTRUCTIONS_FOLDER)
  const file = join(folder, 'AGENTS.md')
  const content = `${DELEGATION_AGENT_INSTRUCTIONS}\n`
  try {
    if ((await readFile(file, 'utf8').catch(() => null)) !== content) {
      await mkdir(folder, { recursive: true })
      // Why: two chats starting together must never leave one reading a half-written file.
      await writeFileDurable(durableWriteTempPath(file), file, content)
    }
    return folder
  } catch {
    return null
  }
}
