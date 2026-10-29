import {
  nativeChatVisualAnnotateMessages,
  type NativeChatVisualAnnotateState
} from '../../../src/shared/native-chat-visual-annotate'
import { MOBILE_NATIVE_CHAT_VISUAL_ANNOTATE_COMMAND } from './mobile-native-chat-visual-host-document'

/**
 * The script the app injects into the WebView's host document to send the annotate state to the
 * visual frame. Each message is passed as a JSON string literal, so the payload is data and never
 * code; the host document parses it and forwards it to its child frame.
 */
export function mobileNativeChatVisualAnnotateInjection(
  state: NativeChatVisualAnnotateState,
  channel: string
): string {
  const calls = nativeChatVisualAnnotateMessages(state, channel).map(
    (message) =>
      `window.${MOBILE_NATIVE_CHAT_VISUAL_ANNOTATE_COMMAND}(${stringLiteral(JSON.stringify(message))});`
  )
  return `${calls.join(' ')} true;`
}

// Line and paragraph separators are legal in a JSON string but not in every engine's string literal.
const BACKSLASH = String.fromCharCode(0x5c)
function stringLiteral(text: string): string {
  return JSON.stringify(text)
    .split(String.fromCharCode(0x2028))
    .join(`${BACKSLASH}u2028`)
    .split(String.fromCharCode(0x2029))
    .join(`${BACKSLASH}u2029`)
}
