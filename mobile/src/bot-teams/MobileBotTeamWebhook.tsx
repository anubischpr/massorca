import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { botTeamWebhookAddress } from '../../../src/shared/bot-team-webhook-path'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { useClipboardWriter } from '../platform/clipboard'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import {
  createMobileBotTeamWebhook,
  replaceMobileBotTeamWebhookSecret,
  type MobileBotTeamWebhookMade
} from './MobileBotTeamWebhookRpc'
import { useMobileBotTeamWebhooks } from './MobileBotTeamWebhookRows'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** Web address (M40): the address, the key shown once, and what a call makes. */
export function MobileBotTeamWebhook({
  client,
  team,
  webhookId,
  offline,
  onBack
}: {
  client: RpcClient
  team: BotTeam
  /** Absent: a new address is being made. */
  webhookId?: string
  offline: boolean
  onBack: () => void
}) {
  const clipboard = useClipboardWriter()
  const copy = async (text: string, done: string) => {
    try {
      await clipboard.writeText(text)
      Alert.alert(done)
    } catch {
      Alert.alert('That did not copy', 'Try again.')
    }
  }
  const read = useMobileBotTeamWebhooks(client, team.id, offline)
  // The key lives here and nowhere else; leaving the screen forgets it.
  const [made, setMade] = useState<MobileBotTeamWebhookMade | null>(null)
  const [botId, setBotId] = useState(team.bots[0]?.id ?? '')
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  const listed = read?.kind === 'ready' ? read.value : null
  const webhook = made?.webhook ?? listed?.webhooks.find((entry) => entry.id === webhookId)
  const endpoint = made?.endpoint ?? listed?.endpoint ?? { state: 'unavailable' as const }
  const bot = team.bots.find((entry) => entry.id === (webhook?.botId ?? botId))
  const address = webhook ? botTeamWebhookAddress(endpoint, team.name, webhook.id) : ''

  const run = async (make: () => Promise<MobileBotTeamWebhookMade | null>) => {
    const next = await make()
    if (next === null) {
      Alert.alert('That did not save', 'Check the connection to this host and try again.')
      return
    }
    setMade(next)
    setConfirmingReplace(false)
  }
  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title="Web address" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.rowMeta}>
          {`Another app calls this address to start one task in ${team.name}. Nothing else is needed.`}
        </Text>
        {endpoint.state === 'unavailable' ? (
          <View style={styles.notice}>
            <Text style={styles.rowTitle}>This host does not take calls yet</Text>
            <Text style={styles.rowMeta}>
              The address and key are saved, but no other app can reach them until this host opens a
              way in. Nothing is started by a call today.
            </Text>
          </View>
        ) : null}
        {read?.kind === 'unsupported' ? (
          <Text style={styles.message}>This host cannot make web addresses yet.</Text>
        ) : null}
        {webhook ? (
          <>
            <Text style={styles.label}>Address (webhook)</Text>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text selectable style={styles.rowTitle}>
                  {address}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void copy(address, 'Address copied')}
              style={styles.secondary}
            >
              <Text style={styles.rowTitle}>Copy address</Text>
            </Pressable>
            <Text style={styles.label}>Secret key</Text>
            {made ? (
              <>
                <View style={styles.notice}>
                  <Text style={styles.rowTitle}>
                    Shown once. Copy it now and keep it safe. You won't see it again.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void copy(made.secret, 'Key copied')}
                    style={styles.secondary}
                  >
                    <Text style={styles.rowTitle}>Copy key</Text>
                  </Pressable>
                </View>
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text selectable style={styles.rowTitle}>
                      {made.secret}
                    </Text>
                    <Text style={styles.rowMeta}>
                      If you lose it, replace the key. The old one stops working.
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>The key is hidden</Text>
                    <Text style={styles.rowMeta}>
                      It was shown once, when this address was made. Only a fingerprint is kept.
                    </Text>
                  </View>
                </View>
                {confirmingReplace ? (
                  <View style={styles.notice}>
                    <Text style={styles.rowTitle}>
                      The old key stops working at once. The other app must use the new one.
                    </Text>
                    <View style={styles.choiceActions}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setConfirmingReplace(false)}
                        style={[styles.secondary, styles.choiceAction]}
                      >
                        <Text style={styles.rowTitle}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Replace key now"
                        disabled={offline}
                        onPress={() =>
                          void run(() => replaceMobileBotTeamWebhookSecret(client, webhook.id))
                        }
                        style={[styles.primary, styles.choiceAction]}
                      >
                        <Text style={styles.primaryText}>Replace key</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmingReplace(true)}
                    style={styles.secondary}
                  >
                    <Text style={styles.rowTitle}>Replace key</Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        ) : webhookId === undefined && listed !== null ? (
          <>
            <Text style={styles.label}>Bot</Text>
            <View style={styles.chips}>
              {team.bots.map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: entry.id === botId }}
                  onPress={() => setBotId(entry.id)}
                  style={[
                    styles.chip,
                    entry.id === botId && styles.rowSelected,
                    styles.sheetHeader
                  ]}
                >
                  <MobileBotAgentIcon agentId={entry.agent} size={16} />
                  <Text style={styles.rowTitle}>{entry.name}</Text>
                </Pressable>
              ))}
            </View>
            {bot?.job ? <Text style={styles.rowMeta}>{bot.job}</Text> : null}
          </>
        ) : null}
        <Text style={styles.label}>What it creates</Text>
        <View style={styles.taskCard}>
          <Text style={styles.rowTitle}>One task</Text>
          <Text style={styles.rowMeta}>
            {`In ${team.name}'s board, in progress, with its own thread.`}
          </Text>
          <Text style={styles.rowTitle}>{`${bot?.name ?? ''} does the work`}</Text>
          <Text style={styles.rowMeta}>
            {`With ${team.accessMode === 'full-access' ? 'full access' : 'ask first'}, as set for ${team.name}.`}
          </Text>
          <Text style={styles.rowTitle}>Nothing else</Text>
          <Text style={styles.rowMeta}>No routine and no schedule. Each call makes one task.</Text>
        </View>
        {webhook ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.primary}>
            <Text style={styles.primaryText}>{made ? 'I have copied the key' : 'Done'}</Text>
          </Pressable>
        ) : webhookId === undefined && listed !== null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !bot || offline }}
            disabled={!bot || offline}
            onPress={() =>
              void run(() => createMobileBotTeamWebhook(client, { teamId: team.id, botId }))
            }
            style={[styles.primary, (!bot || offline) && styles.primaryDisabled]}
          >
            <Text style={styles.primaryText}>Create web address</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}
