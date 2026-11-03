import { botTeamFileNamesText } from '../../../shared/bot-team-room-attachments-line'
import type { BotTeamRoomAttachment } from '../../../shared/bot-team-room-attachments'

/** A host from before files-only messages refuses empty text: send once more with the file names. */
export async function postWithFileNamesIfTextRequired<
  T extends { text: string; attachments?: BotTeamRoomAttachment[] },
  R
>(input: T, send: (input: T) => Promise<R>): Promise<R> {
  try {
    return await send(input)
  } catch (error) {
    const files = input.attachments ?? []
    if (
      input.text.trim() === '' &&
      files.length > 0 &&
      /Missing message text/.test(String(error))
    ) {
      return send({ ...input, text: botTeamFileNamesText(files) })
    }
    throw error
  }
}
