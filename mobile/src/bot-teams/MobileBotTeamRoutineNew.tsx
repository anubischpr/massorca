import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import {
  BOT_TEAM_ROUTINE_FREQUENCIES,
  BOT_TEAM_ROUTINE_MAX_MONTH_DAY,
  hostWallTime,
  onceRoutineRunAt,
  type BotTeamRoutineFrequency
} from '../../../src/shared/bot-team-routine-schedule'
import { localTimeZone } from '../../../src/shared/bot-team-routine-zone'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MOBILE_ROUTINE_WEEKDAYS, mobileRoutineWeekdayName } from './MobileBotTeamRoutineLabels'
import { createMobileBotTeamRoutine } from './MobileBotTeamRoutineRpc'
import { MobileBotTeamRoutineTimePicker } from './MobileBotTeamRoutineTimePicker'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

const FREQUENCY_LABELS: Record<BotTeamRoutineFrequency, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  once: 'Once'
}
const MONTH_DAYS = Array.from({ length: BOT_TEAM_ROUTINE_MAX_MONTH_DAY }, (_, index) => index + 1)
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Tomorrow on this phone's clock, where the date field starts. */
const tomorrowDate = (): string => hostWallTime(Date.now() + 86_400_000).date

function Choice({
  label,
  selected,
  onPress
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.rowSelected]}
    >
      <Text style={styles.rowTitle}>{label}</Text>
    </Pressable>
  )
}

/** New routine (M38): what it does, when, and which bot does it. */
export function MobileBotTeamRoutineNew({
  client,
  team,
  offline,
  onBack,
  onCreated,
  onChangeAccess
}: {
  client: RpcClient
  team: BotTeam
  offline: boolean
  onBack: () => void
  onCreated: () => void
  /** Opens the Bot teams settings, where the team's access is set. */
  onChangeAccess: () => void
}) {
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [frequency, setFrequency] = useState<BotTeamRoutineFrequency>('weekly')
  const [time, setTime] = useState('09:00')
  const [weekday, setWeekday] = useState(1)
  const [monthDay, setMonthDay] = useState(1)
  const [date, setDate] = useState(tomorrowDate)
  const [botId, setBotId] = useState(team.bots[0]?.id ?? '')
  const bot = team.bots.find((entry) => entry.id === botId)
  // Null when this device cannot name its zone: the routine then runs on the host's clock.
  const zone = localTimeZone()
  const schedule = {
    frequency,
    time,
    weekday: frequency === 'weekly' ? weekday : null,
    monthDay: frequency === 'monthly' ? monthDay : null,
    date: frequency === 'once' ? date.trim() : null,
    timeZone: zone
  }
  // The host refuses a one-time routine on a date that is not a real day, so Create waits for one.
  const dateOk = frequency !== 'once' || onceRoutineRunAt(schedule) !== null
  const ready =
    name.trim() !== '' && prompt.trim() !== '' && TIME.test(time) && bot !== undefined && dateOk
  const create = async () => {
    const made = await createMobileBotTeamRoutine(client, {
      teamId: team.id,
      botId,
      name: name.trim(),
      prompt: prompt.trim(),
      schedule
    })
    if (made === null) {
      Alert.alert('That did not save', 'Check the connection to this host and try again.')
      return
    }
    onCreated()
  }
  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title="New routine" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          placeholder="Monday check-in"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>What should it do?</Text>
        <TextInput
          accessibilityLabel="What should it do?"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          placeholder={`List what is still open in ${team.name} and post it in the room.`}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.inputTall]}
        />
        <Text style={styles.label}>When</Text>
        <View style={styles.chips}>
          {BOT_TEAM_ROUTINE_FREQUENCIES.map((entry) => (
            <Choice
              key={entry}
              label={FREQUENCY_LABELS[entry]}
              selected={entry === frequency}
              onPress={() => setFrequency(entry)}
            />
          ))}
        </View>
        {frequency === 'once' ? (
          <>
            <Text style={styles.label}>Date</Text>
            <TextInput
              accessibilityLabel="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, dateOk ? null : { borderColor: colors.statusRed }]}
            />
            {dateOk ? null : <Text style={styles.rowMeta}>Enter a date as YYYY-MM-DD.</Text>}
          </>
        ) : null}
        {frequency === 'weekly' ? (
          <View style={styles.chips}>
            {MOBILE_ROUTINE_WEEKDAYS.map((day) => (
              <Choice
                key={day}
                label={mobileRoutineWeekdayName(day).slice(0, 3)}
                selected={day === weekday}
                onPress={() => setWeekday(day)}
              />
            ))}
          </View>
        ) : null}
        {frequency === 'monthly' ? (
          <View style={styles.chips}>
            {MONTH_DAYS.map((day) => (
              <Choice
                key={day}
                label={String(day)}
                selected={day === monthDay}
                onPress={() => setMonthDay(day)}
              />
            ))}
          </View>
        ) : null}
        <Text style={styles.label}>Time</Text>
        <MobileBotTeamRoutineTimePicker value={time} onChange={setTime} />
        <Text style={styles.rowMeta}>
          {zone
            ? `Runs at this time in ${zone}, your time zone, wherever the host is.`
            : `Runs at this time, on the clock of the host ${team.name} uses. Use 24-hour time, like 09:00.`}
        </Text>
        <Text style={styles.label}>Bot</Text>
        <View style={styles.chips}>
          {team.bots.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected: entry.id === botId }}
              onPress={() => setBotId(entry.id)}
              style={[styles.chip, entry.id === botId && styles.rowSelected, styles.sheetHeader]}
            >
              <MobileBotAgentIcon agentId={entry.agent} size={16} />
              <Text style={styles.rowTitle}>{entry.name}</Text>
            </Pressable>
          ))}
        </View>
        {bot?.job ? <Text style={styles.rowMeta}>{bot.job}</Text> : null}
        <Text style={styles.label}>Access</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>
              {team.accessMode === 'full-access' ? 'Full access' : 'Ask first'}
            </Text>
            <Text style={styles.rowMeta}>
              {`Set for ${team.name} in Settings. This routine uses it.`}
            </Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={onChangeAccess} style={styles.secondary}>
          <Text style={styles.rowTitle}>Change in Settings</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || offline }}
          disabled={!ready || offline}
          onPress={() => void create()}
          style={[styles.primary, (!ready || offline) && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>Create routine</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.secondary}>
          <Text style={styles.rowTitle}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
