import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { ChevronRight, Trash2 } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamWorkBar as SubBar } from './MobileBotTeamWorkBar'
import { deleteMobileBotTeam } from './mobile-bot-team-rpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

type AccessMode = BotTeam['accessMode']

const ACCESS_OPTIONS: readonly { id: AccessMode; label: string }[] = [
  { id: 'full-access', label: 'Full access' },
  { id: 'default', label: 'Ask first' }
]

/** Asks before a team is deleted; its projects and their tasks go with it. Runs onDeleted once the host deletes it. */
export function confirmDeleteBotTeam(client: RpcClient, team: BotTeam, onDeleted: () => void) {
  Alert.alert(`Delete ${team.name}?`, 'Its projects and their tasks are deleted too.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () =>
        void deleteMobileBotTeam(client, team.id).then((deleted) =>
          deleted
            ? onDeleted()
            : Alert.alert('That did not delete', 'Check the connection to this host and try again.')
        )
    }
  ])
}

/** Edit team: name, purpose, access, the team's Marketplace apps, and delete. */
export function MobileBotTeamEditTeam({
  client,
  team,
  onBack,
  onSave,
  onDeleted,
  onOpenMarketplace
}: {
  client: RpcClient
  team: BotTeam
  onBack: () => void
  onSave: (input: { name: string; purpose: string; accessMode: AccessMode }) => void
  onDeleted: () => void
  onOpenMarketplace: () => void
}) {
  const [name, setName] = useState(team.name)
  const [purpose, setPurpose] = useState(team.purpose)
  const [accessMode, setAccessMode] = useState<AccessMode>(team.accessMode)
  const canSave = name.trim().length > 0

  return (
    <>
      <SubBar title="Edit team" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Purpose</Text>
        <TextInput
          accessibilityLabel="Purpose"
          style={[styles.input, styles.inputTall]}
          value={purpose}
          onChangeText={setPurpose}
          multiline
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Access</Text>
        <View style={styles.chips}>
          {ACCESS_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.id === accessMode }}
              onPress={() => setAccessMode(option.id)}
              style={[styles.chip, option.id === accessMode && styles.rowSelected]}
            >
              <Text style={styles.rowTitle}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.rowMeta}>What this team can do without asking.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marketplace apps"
          onPress={onOpenMarketplace}
          style={styles.row}
        >
          <Text style={[styles.rowTitle, styles.grow]}>Marketplace apps</Text>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={() => onSave({ name: name.trim(), purpose: purpose.trim(), accessMode })}
          style={[styles.primary, !canSave && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>Save</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete team…"
          onPress={() => confirmDeleteBotTeam(client, team, onDeleted)}
          style={styles.row}
        >
          <Trash2 size={18} color={colors.statusRed} />
          <Text style={[styles.rowTitle, { color: colors.statusRed }]}>Delete team…</Text>
        </Pressable>
      </ScrollView>
    </>
  )
}
