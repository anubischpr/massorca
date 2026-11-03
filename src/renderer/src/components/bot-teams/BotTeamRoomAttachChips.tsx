import { translate } from '@/i18n/i18n'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'

/** The files a room message names, listed under its text; a chip opens the file when `onOpen` is given. */
export function BotTeamRoomAttachChips({
  files,
  onOpen,
  tag
}: {
  files: readonly BotTeamRoomAttachment[]
  /** Names where the files came from, such as "From Warehouse". */
  tag?: string
  /** Opens the file in the team's Files view. */
  onOpen?: (path: string) => void
}): React.JSX.Element {
  return (
    <ul
      aria-label={translate('components.botTeams.attachedFiles', 'Attached files')}
      className="mt-2 flex flex-wrap gap-1.5"
    >
      {files.map((file) => (
        <li key={file.path} className="flex max-w-full">
          {onOpen ? (
            <button
              type="button"
              title={file.path}
              aria-label={translate('components.botTeams.openFile', 'Open {{file}}', {
                file: file.name
              })}
              className="flex max-w-full items-center rounded-md border border-input px-2 py-0.5 text-xs hover:bg-accent"
              onClick={() => onOpen(file.path)}
            >
              <span className="truncate">{file.name}</span>
              {tag ? <span className="ml-1.5 shrink-0 text-muted-foreground">{tag}</span> : null}
            </button>
          ) : (
            <span
              title={file.path}
              className="flex max-w-full items-center rounded-md border border-input px-2 py-0.5 text-xs"
            >
              <span className="truncate">{file.name}</span>
              {tag ? <span className="ml-1.5 shrink-0 text-muted-foreground">{tag}</span> : null}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
