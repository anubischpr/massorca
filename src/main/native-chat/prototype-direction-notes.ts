// The names and tradeoffs the agent wrote for its directions in directions.json, read beside a request's
// direction files. An absent, oversized or invalid file names no direction; the list still shows the set.

import { z } from 'zod'
import { PROTOTYPE_COUNT_MAX } from '../../shared/prototype-count-setting'
import { PROTOTYPE_DIRECTIONS_FILE_NAME } from '../../shared/prototype-request-folder'
import {
  PROTOTYPE_DIRECTION_NAME_MAX_LENGTH,
  PROTOTYPE_DIRECTION_TRADEOFF_MAX_LENGTH,
  type PrototypeListedDirection
} from '../../shared/rpc-contract/prototype-params'
import { readNativeChatContainedTextFile } from './native-chat-visual-file-read'

// Why a bound: the agent writes this file, so an oversized one is ignored rather than parsed.
const MAX_DIRECTIONS_FILE_BYTES = 16 * 1024

// The names the agent gives its directions; a file of any other shape names none.
const DirectionNotesSchema = z.array(
  z.object({
    letter: z.string().length(1),
    name: z.string().min(1).max(PROTOTYPE_DIRECTION_NAME_MAX_LENGTH),
    tradeoff: z.string().min(1).max(PROTOTYPE_DIRECTION_TRADEOFF_MAX_LENGTH)
  })
)

export type DirectionNote = z.infer<typeof DirectionNotesSchema>[number]

/** The names the agent wrote in directions.json, at most one per direction; none when it cannot be read. */
export async function directionNotesFor(requestFolder: string): Promise<DirectionNote[]> {
  try {
    const read = await readNativeChatContainedTextFile(
      requestFolder,
      PROTOTYPE_DIRECTIONS_FILE_NAME,
      undefined,
      {
        maxBytes: MAX_DIRECTIONS_FILE_BYTES,
        isAllowedName: (file) => file === PROTOTYPE_DIRECTIONS_FILE_NAME
      }
    )
    // Why html: the contained-text reader names every text it reads `html`, whatever the file holds.
    if (!read.ok || !('html' in read)) {
      return []
    }
    const json: unknown = JSON.parse(read.html)
    const parsed = DirectionNotesSchema.safeParse(json)
    return parsed.success ? parsed.data.slice(0, PROTOTYPE_COUNT_MAX) : []
  } catch {
    return []
  }
}

/** Each direction with the name and tradeoff the agent wrote for its letter; the others keep neither. */
export function withDirectionNotes(
  directions: PrototypeListedDirection[],
  notes: readonly DirectionNote[]
): PrototypeListedDirection[] {
  return directions.map((direction) => {
    const note = notes.find((entry) => entry.letter === direction.letter)
    return note === undefined
      ? direction
      : { ...direction, name: note.name, tradeoff: note.tradeoff }
  })
}
