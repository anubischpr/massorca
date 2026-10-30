import type {
  NativeChatVisualsLaunch,
  PrepareNativeChatVisuals
} from '../native-chat/native-chat-visuals-delivery'
import { readNativeChatVisualsInstructions } from '../native-chat/native-chat-visuals-skill-location'

/** The chat's visuals folder and the skill text that teaches it, for a stock Pi or Gentle Shell
 *  chat; null leaves the chat without visuals. */
export async function piChatVisualsFor(
  deps: { prepareVisuals?: PrepareNativeChatVisuals },
  sessionId: string
): Promise<{ visuals: NativeChatVisualsLaunch; instructions: string } | null> {
  const visuals = (await deps.prepareVisuals?.(sessionId)) ?? null
  if (!visuals) {
    return null
  }
  const body = await readNativeChatVisualsInstructions(visuals.skill)
  // Why: one line, like the delegation text beside it, since a .cmd launcher splits a multi-line argument.
  return body === null ? null : { visuals, instructions: body.replace(/\s+/g, ' ') }
}
