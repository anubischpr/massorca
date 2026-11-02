import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamCodeSource,
  BotTeamProject
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { BOT_TEAM_CODE_SOURCES } from './mobile-bot-team-code-source'
import { createMobileBotProject } from './mobile-bot-team-room-rpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'

/** A new project: a name and a goal, plus where its code comes from when the team has Workspaces on. */
export function MobileBotTeamNewProject({
  client,
  team,
  offline = false,
  onCancel,
  onCreated
}: {
  client: RpcClient
  team: BotTeam
  offline?: boolean
  onCancel: () => void
  onCreated: (project: BotTeamProject) => void
}) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [source, setSource] = useState<BotTeamCodeSource>('repo')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const canCreate = name.trim().length > 0 && !saving && !offline

  const create = async () => {
    if (!canCreate) {
      return
    }
    setSaving(true)
    const result = await createMobileBotProject(client, {
      teamId: team.id,
      name: name.trim(),
      goal: goal.trim(),
      codeSource: team.workspacesEnabled ? source : null
    }).finally(() => setSaving(false))
    if (result.kind === 'ok') {
      onCreated(result.project)
    } else if (result.kind === 'unsupported') {
      setNotice('This host cannot create projects yet.')
    } else {
      Alert.alert('That did not save', 'Check the connection to this host and try again.')
    }
  }

  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title="New project" onBack={onCancel} />
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.rowMeta}>A project holds the why. Its tasks hold the how.</Text>
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
        {team.workspacesEnabled ? (
          <>
            <Text style={styles.label}>Source</Text>
            {BOT_TEAM_CODE_SOURCES.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => setSource(option.id)}
                style={[styles.row, source === option.id && styles.rowSelected]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{option.label}</Text>
                  <Text style={styles.rowMeta}>{option.hint}</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
        <Text style={styles.rowMeta}>
          {`The project belongs to ${team.name}. You can write the brief later.`}
        </Text>
        {notice === null ? null : <Text style={styles.rowMeta}>{notice}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create project"
          accessibilityState={{ disabled: !canCreate }}
          disabled={!canCreate}
          onPress={() => create()}
          style={[styles.primary, !canCreate && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>Create project</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondary}>
          <Text style={styles.rowTitle}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
