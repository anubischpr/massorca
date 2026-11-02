import { Archive, ArchiveRestore, Link2, Pencil, Trash2 } from 'lucide-react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'

/** The right-click menu of a project row. Archive and Delete belong to the owner team only. */
export function BotTeamProjectMenu({
  ownedByThisTeam,
  archived,
  onEdit,
  onLinkTeam,
  onArchive,
  onDelete
}: {
  ownedByThisTeam: boolean
  archived: boolean
  onEdit: () => void
  onLinkTeam: () => void
  /** Archives, or restores when the project is archived. */
  onArchive: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <ContextMenuContent className="w-44">
      <ContextMenuItem onSelect={onEdit}>
        <Pencil className="size-3.5" />
        {translate('components.botTeams.projectMenuEdit', 'Edit')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={onLinkTeam}>
        <Link2 className="size-3.5" />
        {translate('components.botTeams.projectMenuLinkTeam', 'Link team')}
      </ContextMenuItem>
      {ownedByThisTeam ? (
        <>
          <ContextMenuItem onSelect={onArchive}>
            {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
            {archived
              ? translate('components.botTeams.projectMenuRestore', 'Restore')
              : translate('components.botTeams.projectMenuArchive', 'Archive')}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 className="size-3.5" />
            {translate('components.botTeams.projectMenuDelete', 'Delete')}
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  )
}
