import { Alert, Pressable, Text, View } from 'react-native'
import { Pencil, Trash2 } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import type { BotTeamRoutine } from '../../../src/shared/rpc-contract/bot-team-routine-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { deleteMobileBotTeamRoutine } from './MobileBotTeamRoutineRpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** Delete asks first, as a project's does; the routine stops and its history goes. */
export function askDeleteMobileBotTeamRoutine(
  client: RpcClient,
  routine: BotTeamRoutine,
  onDeleted: (routineId: string) => void
): void {
  Alert.alert(
    `Delete ${routine.name}?`,
    'It stops running and its run history goes too. Tasks it already started stay on the board.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteMobileBotTeamRoutine(client, routine.id).then((deleted) => {
            if (deleted) {
              onDeleted(routine.id)
            } else {
              Alert.alert('That did not delete', 'Check the connection to this host and try again.')
            }
          })
        }
      }
    ]
  )
}

/** The sheet a long press on a routine opens (board 57): Edit and Delete. */
export function MobileBotTeamRoutineSheet({
  routine,
  onClose,
  onEdit,
  onDelete
}: {
  /** Null keeps the sheet closed. */
  routine: BotTeamRoutine | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  if (routine === null) {
    return null
  }
  return (
    <BottomDrawer visible onClose={onClose} zIndex={6}>
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, styles.grow]}>{routine.name}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onEdit} style={styles.row}>
        <Pencil size={18} color={colors.textSecondary} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Edit</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDelete} style={styles.row}>
        <Trash2 size={18} color={colors.statusRed} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.statusRed }]}>Delete</Text>
        </View>
      </Pressable>
    </BottomDrawer>
  )
}
