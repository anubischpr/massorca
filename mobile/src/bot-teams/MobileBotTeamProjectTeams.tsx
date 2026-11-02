import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Lock, Plus, X } from 'lucide-react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { colors, spacing } from '../theme/mobile-theme'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The Teams field of a project: the owner is fixed, the other teams can be added and taken off. */
export function MobileBotTeamProjectTeams({
  owner,
  linkedTeamIds,
  teams,
  editing,
  disabled = false,
  onChange
}: {
  owner: BotTeam
  linkedTeamIds: readonly string[]
  teams: readonly BotTeam[]
  /** An existing project: the x unlinks, and the help says the project stays in the owner team. */
  editing: boolean
  disabled?: boolean
  onChange: (linkedTeamIds: string[]) => void
}) {
  const [picking, setPicking] = useState(false)
  const linked = linkedTeamIds.flatMap((id) => teams.find((team) => team.id === id) ?? [])
  const addable = teams.filter((team) => team.id !== owner.id && !linkedTeamIds.includes(team.id))
  return (
    <View>
      <Text style={styles.label}>Teams</Text>
      <View style={styles.chips}>
        <View
          style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}
        >
          <MobileBotTeamCharacterIcon character={owner.character} size={20} />
          <Text style={styles.rowTitle}>{`${owner.name}, owner`}</Text>
          <Lock
            size={12}
            color={colors.textMuted}
            accessibilityLabel="The owner team cannot be removed"
          />
        </View>
        {linked.map((team) => (
          <View
            key={team.id}
            style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}
          >
            <MobileBotTeamCharacterIcon character={team.character} size={20} />
            <Text style={styles.rowTitle}>{team.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editing ? `Unlink ${team.name}` : `Remove ${team.name}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              hitSlop={8}
              onPress={() => onChange(linkedTeamIds.filter((id) => id !== team.id))}
            >
              <X size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        {addable.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, expanded: picking }}
            disabled={disabled}
            onPress={() => setPicking(!picking)}
            style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}
          >
            <Plus size={14} color={colors.textSecondary} />
            <Text style={styles.rowTitle}>Add team</Text>
          </Pressable>
        ) : null}
      </View>
      {picking
        ? addable.map((team) => (
            <Pressable
              key={team.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${team.name}`}
              onPress={() => {
                setPicking(false)
                onChange([...linkedTeamIds, team.id])
              }}
              style={styles.row}
            >
              <MobileBotTeamCharacterIcon character={team.character} size={20} />
              <Text style={styles.rowTitle}>{team.name}</Text>
            </Pressable>
          ))
        : null}
      <Text style={[styles.rowMeta, { marginTop: spacing.sm }]}>
        {editing
          ? "Linked teams can work on this project's tasks. Tap x to unlink a team; the project stays in the owner team."
          : "Linked teams can work on this project's tasks."}
      </Text>
    </View>
  )
}
