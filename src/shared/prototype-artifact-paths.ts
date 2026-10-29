// Which recorded paths are prototype files. They live in a request folder of a chat's visuals folder
// and belong to the Prototypes view, so the Artifacts and Results lists leave them out.
import { isPrototypePath } from './prototype-request-folder'

// The host's visuals root and the per-chat folder under it; the same names native-chat-visuals-folder.ts uses.
const VISUALS_FOLDER_NAME = 'native-chat-visuals'
const VISUALS_CHAT_FOLDER = /^[0-9a-f]{32}$/u

/**
 * True for a path under `prototypes/` relative to a chat's visuals folder, or for the absolute form
 * of one: `.../native-chat-visuals/<chat folder>/prototypes/...`.
 */
export function isPrototypeArtifactPath(path: string): boolean {
  if (isPrototypePath(path)) {
    return true
  }
  const segments = path.split(/[\\/]/u).filter((segment) => segment.length > 0)
  const index = segments.indexOf(VISUALS_FOLDER_NAME)
  const chatFolder = index === -1 ? undefined : segments[index + 1]
  return (
    chatFolder !== undefined &&
    VISUALS_CHAT_FOLDER.test(chatFolder) &&
    isPrototypePath(segments.slice(index + 2).join('/'))
  )
}
