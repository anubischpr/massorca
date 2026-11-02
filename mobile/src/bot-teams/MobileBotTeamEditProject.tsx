import { useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { updateMobileBotProject } from './mobile-bot-team-project-rpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { MobileBotTeamProjectTeams } from './MobileBotTeamProjectTeams'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'

/** Edit project: name, goal and Teams. The screen opens over the room menu and closes on Save. */
export function MobileBotTeamEditProject({
  client,
  project,
  actingTeam,
  teams,
  offline = false,
  onClose,
  onSaved
}: {
  client: RpcClient
  project: BotTeamProject
  /** The team whose room menu the project was opened from. */
  actingTeam: BotTeam
  teams: readonly BotTeam[]
  offline?: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const owner = teams.find((team) => team.id === project.teamId) ?? actingTeam
  const [name, setName] = useState(project.name)
  const [goal, setGoal] = useState(project.goal)
  const [linkedTeamIds, setLinkedTeamIds] = useState<string[]>(project.linkedTeamIds ?? [])
  const [saving, setSaving] = useState(false)
  const canSave = name.trim().length > 0 && !saving && !offline

  const save = async () => {
    if (!canSave) {
      return
    }
    setSaving(true)
    const result = await updateMobileBotProject(client, {
      projectId: project.id,
      teamId: actingTeam.id,
      name: name.trim(),
      goal: goal.trim(),
      linkedTeamIds
    }).finally(() => setSaving(false))
    if (result.kind === 'ok') {
      onSaved()
      onClose()
    } else if (result.kind === 'unsupported') {
      Alert.alert('That did not save', 'This host cannot edit projects yet.')
    } else if (result.kind === 'refused') {
      Alert.alert('That did not save', result.message)
    } else {
      Alert.alert('That did not save', 'Check the connection to this host and try again.')
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <MobileBotTeamWorkBar title="Edit project" onBack={onClose} />
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            accessibilityLabel="Name"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Goal</Text>
          <TextInput
            accessibilityLabel="Goal"
            style={[styles.input, styles.inputTall]}
            value={goal}
            onChangeText={setGoal}
            multiline
            placeholderTextColor={colors.textMuted}
          />
          <MobileBotTeamProjectTeams
            owner={owner}
            linkedTeamIds={linkedTeamIds}
            teams={teams}
            editing
            disabled={saving}
            onChange={setLinkedTeamIds}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save"
            accessibilityState={{ disabled: !canSave }}
            disabled={!canSave}
            onPress={() => save()}
            style={[styles.primary, !canSave && styles.primaryDisabled]}
          >
            <Text style={styles.primaryText}>Save</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
            <Text style={styles.rowTitle}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  )
}
