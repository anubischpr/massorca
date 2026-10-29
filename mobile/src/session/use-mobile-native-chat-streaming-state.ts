import { mobileNativeChatStreamPreview } from './mobile-native-chat-streaming-gate'
import { useThrottledLatestValue } from './use-throttled-latest-value'

const NATIVE_CHAT_STREAM_THROTTLE_MS = 50

/** Whether the chat's agent is mid-turn and the streaming bubble's text, for either lane. */
export function useMobileNativeChatStreamingState(args: {
  structured: boolean
  structuredWorking: boolean
  terminalWorking: boolean
  /** The terminal lane's transcript resolution exists. */
  resolved: boolean
  status: Parameters<typeof mobileNativeChatStreamPreview>[0]
}): { live: boolean; agentWorking: boolean; text: string | undefined } {
  const { structured, structuredWorking, terminalWorking, resolved, status } = args
  // Deliberately not gated on the chat view being visible: the streaming gate
  // has to tell "hidden mid-turn" from "the turn ended".
  const live = structured ? structuredWorking : terminalWorking
  const agentWorking = live && (structured || resolved)
  // Throttle the streaming bubble: OpenCode emits a status frame per streamed
  // part, and each one re-renders and re-parses the whole accumulated markdown.
  const text = useThrottledLatestValue(
    structured ? undefined : mobileNativeChatStreamPreview(status, agentWorking),
    NATIVE_CHAT_STREAM_THROTTLE_MS
  )
  return { live, agentWorking, text: text ?? undefined }
}
