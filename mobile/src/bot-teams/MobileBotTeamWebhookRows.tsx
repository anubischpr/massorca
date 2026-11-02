import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight, Plug } from 'lucide-react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { mobileRoutineDateLabel } from './MobileBotTeamRoutineLabels'
import { listMobileBotTeamWebhooks } from './MobileBotTeamWebhookRpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

type WebhooksRead = Awaited<ReturnType<typeof listMobileBotTeamWebhooks>>

/** A team's web addresses as the host last answered. */
export function useMobileBotTeamWebhooks(client: RpcClient, teamId: string, offline: boolean) {
  const [read, setRead] = useState<WebhooksRead | null>(null)
  useEffect(() => {
    if (offline) {
      return
    }
    let current = true
    void listMobileBotTeamWebhooks(client, teamId).then((next) => {
      if (current) {
        setRead(next)
      }
    })
    return () => {
      current = false
    }
  }, [client, teamId, offline])
  return read
}

/** Web addresses (the lower half of M36 and M37): another app can start a task by calling one. */
export function MobileBotTeamWebhookRows({
  client,
  team,
  offline,
  onOpen
}: {
  client: RpcClient
  team: BotTeam
  offline: boolean
  /** No id means making a new one. */
  onOpen: (webhookId?: string) => void
}) {
  const read = useMobileBotTeamWebhooks(client, team.id, offline)
  if (read === null) {
    return null
  }
  return (
    <>
      <Text style={styles.label}>Web addresses</Text>
      {read.kind === 'unsupported' ? (
        <Text style={styles.message}>This host cannot make web addresses yet.</Text>
      ) : null}
      {read.kind === 'ready' && read.value.webhooks.length === 0 ? (
        <>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>No web addresses yet</Text>
              <Text style={styles.rowMeta}>
                {`Another app can call one to start a task in ${team.name}.`}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpen()}
            style={[styles.secondary, offline && styles.disabledAction]}
          >
            <Text style={styles.rowTitle}>New web address</Text>
          </Pressable>
        </>
      ) : null}
      {read.kind === 'ready'
        ? read.value.webhooks.map((webhook) => {
            const bot = team.bots.find((entry) => entry.id === webhook.botId)
            return (
              <Pressable
                key={webhook.id}
                accessibilityRole="button"
                accessibilityLabel="Open web address"
                onPress={() => onOpen(webhook.id)}
                style={styles.row}
              >
                <Plug size={18} color={colors.textSecondary} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Start a task from another app</Text>
                  <Text style={styles.rowMeta}>
                    {webhook.lastCall
                      ? `${bot?.name ?? ''}. One task for each call. Last call ${mobileRoutineDateLabel(webhook.lastCall)}.`
                      : `${bot?.name ?? ''}. One task for each call. No calls yet.`}
                  </Text>
                  {read.value.endpoint.state === 'unavailable' ? (
                    <Text style={styles.rowMeta}>This host does not take calls yet.</Text>
                  ) : null}
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </Pressable>
            )
          })
        : null}
    </>
  )
}
