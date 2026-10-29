// Which recorded paths are prototype files. They live in a request folder of a chat's visuals folder
// and belong to the Prototypes view, so the Artifacts and Results lists leave them out.
import { isPrototypePath } from './prototype-request-folder'
import {
  NATIVE_CHAT_VISUALS_CHAT_FOLDER_PATTERN,
  NATIVE_CHAT_VISUALS_DIR_NAME
} from './native-chat-visuals-folder-layout'

/**
 * True for a path under `prototypes/` relative to a chat's visuals folder, or for the absolute form
 * of one: `.../native-chat-visuals/<chat folder>/prototypes/...`.
 */
export function isPrototypeArtifactPath(path: string): boolean {
  if (isPrototypePath(path)) {
    return true
  }
  const segments = path.split(/[\\/]/u).filter((segment) => segment.length > 0)
  const index = segments.indexOf(NATIVE_CHAT_VISUALS_DIR_NAME)
  const chatFolder = index === -1 ? undefined : segments[index + 1]
  return (
    chatFolder !== undefined &&
    NATIVE_CHAT_VISUALS_CHAT_FOLDER_PATTERN.test(chatFolder) &&
    isPrototypePath(segments.slice(index + 2).join('/'))
  )
}
