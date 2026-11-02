import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, SlidersHorizontal, Sparkles } from 'lucide-react-native'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { colors } from '../theme/mobile-theme'
import { BOT_AGENT_CHOICES, botAgentLabel } from '../../../src/shared/bot-team-character-art'
import {
  botModelOptions,
  botModelOptionsFromListing,
  botModelSummary,
  type BotModelOption
} from '../../../src/shared/bot-team-model-options'
import { readHostModelCatalog } from '../create-session/use-create-session-options'
import type { RpcClient } from '../transport/rpc-client'
import {
  BOT_TEAM_CHARACTERS,
  type BotDraftInput,
  type BotTeamCreateInput
} from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'

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

function ChoiceRow({
  options,
  selected,
  onPick
}: {
  options: readonly { id: string; label: string }[]
  selected: string | null
  onPick: (id: string) => void
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="radio"
          accessibilityState={{ selected: option.id === selected }}
          onPress={() => onPick(option.id)}
          style={[styles.chip, option.id === selected && styles.rowSelected]}
        >
          <Text style={styles.rowTitle}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function MobileAddBotForm({
  client,
  initial,
  onAdd
}: {
  client: RpcClient
  /** The bot being edited; absent when adding a new one. */
  initial?: BotDraftInput
  onAdd: (bot: BotDraftInput) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [job, setJob] = useState(initial?.job ?? '')
  const [agent, setAgent] = useState<BotDraftInput['agent']>(
    initial?.agent ?? BOT_AGENT_CHOICES[0].id
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [modelMode, setModelMode] = useState(initial?.modelMode ?? 'auto')
  const [model, setModel] = useState(initial?.model ?? null)
  const [effort, setEffort] = useState(initial?.effort ?? null)
  const trimmedName = name.trim()
  const [listed, setListed] = useState<{ agent: string; options: BotModelOption[] } | null>(null)
  // The list the session chooser reads, from the host that will run the bot.
  useEffect(() => {
    let stale = false
    readHostModelCatalog(client, agent, null).then(
      (catalog) => {
        if (!stale) {
          setListed({
            agent,
            options: botModelOptionsFromListing(
              agent,
              catalog.origin === 'unknown' ? [] : catalog.models
            )
          })
        }
      },
      () => {}
    )
    return () => {
      stale = true
    }
  }, [client, agent])
  const fromHost = listed?.agent === agent ? listed.options : []
  const models = fromHost.length > 0 ? fromHost : botModelOptions(agent)
  const manual = modelMode === 'manual' && models.length > 0
  const efforts = models.find((entry) => entry.id === model)?.efforts ?? []
  // The host picks again on save, so what it picked before only holds while these are unchanged.
  const automaticSummary =
    initial?.agent === agent && initial.job === job.trim() && initial.modelMode === 'auto'
      ? botModelSummary({ agent, model: initial.model ?? null, effort: initial.effort ?? null })
      : null
  const modelLine =
    models.length === 0
      ? `${botAgentLabel(agent)} uses its own default model.`
      : manual
        ? 'Each new task starts with your choice.'
        : automaticSummary
          ? `Automatic: ${automaticSummary}.`
          : 'Picked for this job when you save.'
  const pickModel = (id: string) => {
    const next = models.find((entry) => entry.id === id)?.efforts ?? []
    setModel(id)
    setEffort(next.some((entry) => entry.value === effort) ? effort : (next.at(-1)?.value ?? null))
  }
  const pickAgent = (id: BotDraftInput['agent']) => {
    setAgent(id)
    // A model belongs to its agent, so a new agent starts automatic again.
    setModelMode('auto')
    setModel(null)
    setEffort(null)
  }
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
          onPress={() => pickAgent(choice.id)}
          style={[styles.row, agent === choice.id && styles.rowSelected]}
        >
          <MobileBotAgentIcon agentId={choice.id} size={20} />
          <Text style={styles.rowTitle}>{choice.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedOpen }}
        onPress={() => setAdvancedOpen(!advancedOpen)}
        style={styles.row}
      >
        {advancedOpen ? (
          <ChevronDown size={18} color={colors.textSecondary} />
        ) : (
          <ChevronRight size={18} color={colors.textSecondary} />
        )}
        <Text style={styles.rowTitle}>Advanced options</Text>
      </Pressable>
      {advancedOpen ? (
        <>
          <View style={styles.row}>
            <Sparkles size={18} color={colors.textSecondary} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Skills</Text>
              <Text style={styles.rowMeta}>
                {initial?.skills?.join(', ') || 'None chosen'}. Choose them on the desktop app.
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <SlidersHorizontal size={18} color={colors.textSecondary} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Model and effort</Text>
              <Text style={styles.rowMeta}>{modelLine}</Text>
            </View>
          </View>
          {models.length > 0 ? (
            <ChoiceRow
              options={[
                { id: 'auto', label: 'Automatic' },
                { id: 'manual', label: 'Choose' }
              ]}
              selected={manual ? 'manual' : 'auto'}
              onPick={(id) => {
                if (id === 'manual') {
                  setModelMode('manual')
                  pickModel(model ?? models[0].id)
                } else {
                  setModelMode('auto')
                  setModel(null)
                  setEffort(null)
                }
              }}
            />
          ) : null}
          {manual ? (
            <>
              <Text style={styles.label}>Model</Text>
              <ChoiceRow options={models} selected={model} onPick={pickModel} />
              {efforts.length > 0 ? (
                <>
                  <Text style={styles.label}>Effort</Text>
                  <ChoiceRow
                    options={efforts.map((entry) => ({ id: entry.value, label: entry.label }))}
                    selected={effort}
                    onPick={setEffort}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      <PrimaryButton
        label={initial ? 'Save' : 'Add bot'}
        disabled={trimmedName === ''}
        onPress={() =>
          onAdd({
            name: trimmedName,
            job: job.trim(),
            agent,
            modelMode: manual ? 'manual' : 'auto',
            model: manual ? model : null,
            effort: manual ? effort : null,
            ...(initial?.skills ? { skills: initial.skills } : {})
          })
        }
      />
    </ScrollView>
  )
}

export function MobileNewTeamForm({
  usedCharacters,
  onOpenAddBot,
  onEditBot,
  bots,
  onCreate
}: {
  usedCharacters: readonly string[]
  onOpenAddBot: () => void
  onEditBot: (index: number) => void
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
        <MobileBotTeamCharacterIcon character={character} size={56} still />
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
      {bots.map((bot, index) => (
        <Pressable
          key={index}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${bot.name}`}
          onPress={() => onEditBot(index)}
          style={styles.row}
        >
          <MobileBotAgentIcon agentId={bot.agent} size={20} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{bot.name}</Text>
            <Text style={styles.rowMeta}>{botAgentLabel(bot.agent)}</Text>
          </View>
        </Pressable>
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
