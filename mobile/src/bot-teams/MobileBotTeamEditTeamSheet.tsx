import { Pressable, Text, View } from 'react-native'
import { Pencil, Trash2 } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors } from '../theme/mobile-theme'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { confirmDeleteBotTeam } from './MobileBotTeamEditTeam'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The sheet a long press on a team's character opens: Edit team and Delete team. */
export function MobileBotTeamEditTeamSheet({
  client,
  team,
  onClose,
  onEdit,
  onDeleted
}: {
  client: RpcClient
  /** Null keeps the sheet closed. */
  team: BotTeam | null
  onClose: () => void
  onEdit: (team: BotTeam) => void
  onDeleted: () => void
}) {
  if (team === null) {
    return null
  }
  return (
    <BottomDrawer visible onClose={onClose}>
      <View style={styles.sheetHeader}>
        <MobileBotTeamCharacterIcon character={team.character} size={28} still />
        <Text style={styles.sheetTitle}>{team.name}</Text>
      </View>
      <SheetRow
        icon={<Pencil size={18} color={colors.textSecondary} />}
        title="Edit team"
        onPress={() => {
          onClose()
          onEdit(team)
        }}
      />
      <SheetRow
        icon={<Trash2 size={18} color={colors.statusRed} />}
        title="Delete team…"
        danger
        onPress={() => {
          onClose()
          confirmDeleteBotTeam(client, team, onDeleted)
        }}
      />
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={styles.row}
    >
      {icon}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && { color: colors.statusRed }]}>{title}</Text>
      </View>
    </Pressable>
  )
}
