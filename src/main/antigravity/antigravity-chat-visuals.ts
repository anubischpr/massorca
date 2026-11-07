import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import type {
  NativeChatVisualsLaunch,
  PrepareNativeChatVisuals
} from '../native-chat/native-chat-visuals-delivery'
import { readNativeChatVisualsInstructions } from '../native-chat/native-chat-visuals-skill-location'

/** The chat's visuals folder with the skill written into it as AGENTS.md, which agy reads from every
 *  folder it is given; null leaves the chat without visuals. */
export async function antigravityVisualsFor(
  deps: { prepareVisuals?: PrepareNativeChatVisuals; logger?: StructuredAgentSessionLogger },
  sessionId: string,
  cwd: string
): Promise<NativeChatVisualsLaunch | null> {
  const visuals = (await deps.prepareVisuals?.(sessionId, cwd)) ?? null
  if (!visuals) {
    return null
  }
  const instructions = await readNativeChatVisualsInstructions(visuals.skill)
  if (instructions === null) {
    return null
  }
  try {
    await writeFile(join(visuals.folder, 'AGENTS.md'), `${instructions}\n`)
    return visuals
  } catch (error) {
    deps.logger?.warn('the chat visuals instructions could not be written', {
      scope: 'nativeChatVisuals.antigravity',
      sessionId,
      error
    })
    return null
  }
}
