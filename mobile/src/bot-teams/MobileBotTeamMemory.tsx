import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import type { BotTeamMemoryEntry } from '../../../src/shared/rpc-contract/bot-team-memory-params'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { RpcClient } from '../transport/rpc-client'
import {
  deleteMobileBotTeamMemory,
  listMobileBotTeamMemory,
  type MobileBotTeamMemoryResult
} from './mobile-bot-team-memory-rpc'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

const TEAM_TAB = 'team'

function sourceLine(entry: BotTeamMemoryEntry, botName: string | null): string {
  if (entry.source.kind === 'task') {
    return `From the ${entry.source.taskTitle ?? ''} task`
  }
  return botName ? `You told ${botName}` : 'You told the team'
}

/** What the team and each bot remember, and the way to make them forget a line for good. */
export function MobileBotTeamMemory({
  client,
  team,
  offline,
  onBack
}: {
  client: RpcClient
  team: BotTeam
  offline: boolean
  onBack: () => void
}) {
  const [result, setResult] = useState<MobileBotTeamMemoryResult | null>(null)
  const [tab, setTab] = useState(TEAM_TAB)

  useEffect(() => {
    if (offline) {
      return
    }
    let current = true
    void listMobileBotTeamMemory(client, team.id).then((next) => {
      if (current) {
        setResult(next)
      }
    })
    return () => {
      current = false
    }
  }, [client, offline, team.id])

  const forget = async (entry: BotTeamMemoryEntry) => {
    if (!(await deleteMobileBotTeamMemory(client, entry.id))) {
      Alert.alert('That did not delete', 'Check the connection to this host and try again.')
      return
    }
    setResult((current) =>
      current?.kind === 'ready'
        ? { kind: 'ready', memory: current.memory.filter((line) => line.id !== entry.id) }
        : current
    )
  }

  const bot = team.bots.find((candidate) => candidate.id === tab) ?? null
  const shown =
    result?.kind === 'ready' ? result.memory.filter((line) => line.botId === (bot?.id ?? null)) : []
  const chips = [{ id: TEAM_TAB, name: 'Team' }, ...team.bots]

  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title="Memory" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Pressable
              key={chip.id}
              accessibilityRole="button"
              accessibilityState={{ selected: chip.id === tab }}
              onPress={() => setTab(chip.id)}
              style={[styles.chip, chip.id === tab && styles.rowSelected]}
            >
              <Text style={styles.rowTitle}>{chip.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.rowTitle}>
          {bot ? `What ${bot.name} remembers` : 'What the team remembers'}
        </Text>
        <Text style={styles.rowMeta}>
          {bot
            ? `Only ${bot.name} uses this. Delete anything you want ${bot.name} to forget.`
            : 'All bots in this team can use this. Delete anything you want them to forget.'}
        </Text>
        {result?.kind === 'unsupported' ? (
          <Text style={styles.message}>This host cannot show what the team remembers yet.</Text>
        ) : null}
        {offline || result?.kind === 'failed' ? (
          <Text style={styles.message}>Check the connection to this host and try again.</Text>
        ) : null}
        {result?.kind === 'ready' && shown.length === 0 ? (
          <Text style={styles.message}>Nothing remembered here.</Text>
        ) : null}
        {shown.map((line) => (
          <View key={line.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{line.text}</Text>
              <Text style={styles.rowMeta}>{sourceLine(line, bot?.name ?? null)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${line.text}`}
              accessibilityState={{ disabled: offline }}
              disabled={offline}
              onPress={() => void forget(line)}
              style={styles.secondary}
            >
              <Text style={styles.rowTitle}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
