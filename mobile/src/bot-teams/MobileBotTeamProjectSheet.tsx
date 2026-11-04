import { Pressable, Text, View } from 'react-native'
import { Archive, ArchiveRestore, Folder, Link2, Pencil, Trash2 } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { colors } from '../theme/mobile-theme'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/**
 * The sheet a long press on a project opens. Archive, Restore and Delete belong to the owner
 * team, so a project another team owns gets Edit and Link team only.
 */
export function MobileBotTeamProjectSheet({
  project,
  ownerName,
  ownedByThisTeam,
  onClose,
  onEdit,
  onLinkTeam,
  onArchive,
  onDelete
}: {
  /** Null keeps the sheet closed. */
  project: BotTeamProject | null
  ownerName: string
  ownedByThisTeam: boolean
  onClose: () => void
  onEdit: () => void
  onLinkTeam: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  if (project === null) {
    return null
  }
  const archived = project.archivedAt != null
  return (
    <BottomDrawer visible onClose={onClose} zIndex={6}>
      <View style={styles.sheetHeader}>
        <Folder size={20} color={colors.textSecondary} />
        <Text style={[styles.sheetTitle, styles.grow]}>{project.name}</Text>
        <Text style={styles.rowMeta}>{archived ? 'Archived' : ownerName}</Text>
      </View>
      <SheetRow
        icon={<Pencil size={18} color={colors.textSecondary} />}
        title="Edit"
        onPress={onEdit}
      />
      <SheetRow
        icon={<Link2 size={18} color={colors.textSecondary} />}
        title="Link team"
        onPress={onLinkTeam}
      />
      {ownedByThisTeam ? (
        <>
          <SheetRow
            icon={
              archived ? (
                <ArchiveRestore size={18} color={colors.textSecondary} />
              ) : (
                <Archive size={18} color={colors.textSecondary} />
              )
            }
            title={archived ? 'Restore' : 'Archive'}
            onPress={onArchive}
          />
          <SheetRow
            icon={<Trash2 size={18} color={colors.statusRed} />}
            title="Delete"
            danger
            onPress={onDelete}
          />
        </>
      ) : null}
    </BottomDrawer>
  )
}

function SheetRow({
  icon,
  title,
  danger = false,
  onPress
}: {
  icon: React.ReactNode
  title: string
  danger?: boolean
  onPress: () => void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      {icon}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && { color: colors.statusRed }]}>{title}</Text>
      </View>
    </Pressable>
  )
}
