import { useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { colors } from '../theme/mobile-theme'
import {
  BOT_AGENT_CHOICES,
  botAgentLabel,
  type BotAgentId
} from '../../../src/shared/bot-team-character-art'
import {
  BOT_TEAM_CHARACTERS,
  type BotDraftInput,
  type BotTeamCreateInput
} from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

function PrimaryButton({
  label,
  disabled,
  onPress
}: {
  label: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primary, disabled && styles.primaryDisabled]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  )
}

export function MobileAddBotForm({ onAdd }: { onAdd: (bot: BotDraftInput) => void }) {
  const [name, setName] = useState('')
  const [job, setJob] = useState('')
  const [agent, setAgent] = useState<BotAgentId>(BOT_AGENT_CHOICES[0].id)
  const trimmedName = name.trim()
  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Name"
      />
      <Text style={styles.label}>Job</Text>
      <TextInput style={styles.input} value={job} onChangeText={setJob} accessibilityLabel="Job" />
      <Text style={styles.label}>Powered by</Text>
      {BOT_AGENT_CHOICES.map((choice) => (
        <Pressable
          key={choice.id}
          accessibilityRole="radio"
          accessibilityState={{ selected: agent === choice.id }}
          onPress={() => setAgent(choice.id)}
          style={[styles.row, agent === choice.id && styles.rowSelected]}
        >
          <MobileAgentIcon agentId={choice.id} size={20} />
          <Text style={styles.rowTitle}>{choice.label}</Text>
        </Pressable>
      ))}
      <PrimaryButton
        label="Add bot"
        disabled={trimmedName === ''}
        onPress={() => onAdd({ name: trimmedName, job: job.trim(), agent })}
      />
    </ScrollView>
  )
}

export function MobileNewTeamForm({
  usedCharacters,
  onOpenAddBot,
  bots,
  onCreate
}: {
  usedCharacters: readonly string[]
  onOpenAddBot: () => void
  bots: readonly BotDraftInput[]
  onCreate: (input: BotTeamCreateInput) => void
}) {
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [character, setCharacter] = useState(
    () => BOT_TEAM_CHARACTERS.find((c) => !usedCharacters.includes(c)) ?? BOT_TEAM_CHARACTERS[0]
  )
  const [workspacesEnabled, setWorkspacesEnabled] = useState(false)
  const trimmedName = name.trim()
  const nextCharacter = () =>
    setCharacter(
      BOT_TEAM_CHARACTERS[(BOT_TEAM_CHARACTERS.indexOf(character) + 1) % BOT_TEAM_CHARACTERS.length]
    )
  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Team name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Team name"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change team character"
        onPress={nextCharacter}
        style={styles.row}
      >
        <MobileBotTeamCharacterIcon character={character} size={56} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Team character</Text>
          <Text style={styles.rowMeta}>Tap to change</Text>
        </View>
      </Pressable>
      <Text style={styles.label}>What is this team for?</Text>
      <TextInput
        style={[styles.input, styles.inputTall]}
        value={purpose}
        onChangeText={setPurpose}
        multiline
        accessibilityLabel="What is this team for?"
      />
      <Text style={styles.label}>Bots</Text>
      {bots.map((bot) => (
        <View key={bot.name} style={styles.row}>
          <MobileAgentIcon agentId={bot.agent} size={20} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{bot.name}</Text>
            <Text style={styles.rowMeta}>{botAgentLabel(bot.agent)}</Text>
          </View>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={onOpenAddBot} style={styles.row}>
        <Text style={styles.rowTitle}>Add a bot</Text>
      </Pressable>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Workspaces</Text>
          <Text style={styles.rowMeta}>
            Projects can connect to code and be followed in Workspaces.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Workspaces"
          value={workspacesEnabled}
          onValueChange={setWorkspacesEnabled}
          trackColor={{ true: colors.textSecondary }}
        />
      </View>
      <PrimaryButton
        label="Create team"
        disabled={trimmedName === ''}
        onPress={() =>
          onCreate({
            name: trimmedName,
            purpose: purpose.trim(),
            character,
            workspacesEnabled,
            bots: [...bots]
          })
        }
      />
    </ScrollView>
  )
}
