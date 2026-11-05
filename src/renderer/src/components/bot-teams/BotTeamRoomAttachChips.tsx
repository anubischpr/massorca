import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import { BotTeamFileHoverPreview } from './BotTeamFileHoverPreview'

/**
 * The files a room message names, listed under its text. A chip opens the file when `onOpen` is
 * given, and with `teamId` it previews the file on hover.
 */
export function BotTeamRoomAttachChips({
  files,
  onOpen,
  tag,
  teamId
}: {
  files: readonly BotTeamRoomAttachment[]
  /** Names where the files came from, such as "From Warehouse". */
  tag?: string
  /** Opens the file in the team's Files view. */
  onOpen?: (path: string) => void
  /** The team whose folder holds the files; its hover card reads them from there. */
  teamId?: string
}): React.JSX.Element {
  return (
    <ul
      aria-label={translate('components.botTeams.attachedFiles', 'Attached files')}
      className="mt-2 flex flex-wrap gap-1.5"
    >
      {files.map((file) => {
        const FileIcon = getFileTypeIcon(file.path)
        const label = (
          <>
            <FileIcon aria-hidden className="mr-1.5 size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.name}</span>
            {tag ? <span className="ml-1.5 shrink-0 text-muted-foreground">{tag}</span> : null}
          </>
        )
        // Why: the hover card names the file, so the native tooltip would only repeat the path.
        const chip = onOpen ? (
          <button
            type="button"
            title={teamId ? undefined : file.path}
            aria-label={translate('components.botTeams.openFile', 'Open {{file}}', {
              file: file.name
            })}
            className="flex max-w-full items-center rounded-md border border-input px-2 py-0.5 text-xs hover:bg-accent"
            onClick={() => onOpen(file.path)}
          >
            {label}
          </button>
        ) : (
          <span
            title={teamId ? undefined : file.path}
            className="flex max-w-full items-center rounded-md border border-input px-2 py-0.5 text-xs"
          >
            {label}
          </span>
        )
        return (
          <li key={file.path} className="flex max-w-full">
            {teamId ? (
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>{chip}</HoverCardTrigger>
                <HoverCardContent side="top" align="start" variant="workspace-details">
                  <BotTeamFileHoverPreview teamId={teamId} path={file.path} name={file.name} />
                </HoverCardContent>
              </HoverCard>
            ) : (
              chip
            )}
          </li>
        )
      })}
    </ul>
  )
}
