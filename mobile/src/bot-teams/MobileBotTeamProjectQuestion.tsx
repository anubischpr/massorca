import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The room's question when a request names no project of a team that has projects: which one it is for. */
export function MobileBotTeamProjectQuestion({
  projects,
  busy,
  onAnswer
}: {
  projects: readonly BotTeamProject[]
  busy: boolean
  /** The chosen project's id, or null for none. */
  onAnswer: (projectId: string | null) => void
}) {
  // Null is "No project", picked first as on the desktop.
  const [picked, setPicked] = useState<string | null>(null)
  const options: { id: string | null; name: string }[] = [
    { id: null, name: 'No project' },
    ...projects.map((project) => ({ id: project.id, name: project.name }))
  ]
  return (
    <View style={styles.taskCard}>
      <Text style={styles.rowTitle}>Which project is this for?</Text>
      {options.map((option) => {
        const selected = option.id === picked
        return (
          <Pressable
            key={option.id ?? 'none'}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: busy }}
            disabled={busy}
            onPress={() => setPicked(option.id)}
            style={[styles.row, selected && styles.rowSelected]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{option.name}</Text>
            </View>
          </Pressable>
        )
      })}
      <View style={styles.choiceActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => onAnswer(picked)}
          style={[styles.primary, styles.choiceAction, busy && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  )
}
