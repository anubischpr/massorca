import { translate } from '@/i18n/i18n'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'

/** The files a room message names, listed under its text. */
export function BotTeamRoomAttachChips({
  files
}: {
  files: readonly BotTeamRoomAttachment[]
}): React.JSX.Element {
  return (
    <ul
      aria-label={translate('components.botTeams.attachedFiles', 'Attached files')}
      className="mt-2 flex flex-wrap gap-1.5"
    >
      {files.map((file) => (
        <li
          key={file.path}
          title={file.path}
          className="flex max-w-full items-center rounded-md border border-input px-2 py-0.5 text-xs"
        >
          <span className="truncate">{file.name}</span>
        </li>
      ))}
    </ul>
  )
}
