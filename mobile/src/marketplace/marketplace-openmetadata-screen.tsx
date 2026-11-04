import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useHostClient } from '../transport/client-context'
import type { MarketplaceAppStatus } from '../../../src/shared/marketplace-apps'
import { catalogAgentName } from './marketplace-catalog-model'
import { CatalogIcon } from './marketplace-catalog-row'
import { MarketplaceCredentialForm } from './marketplace-credential-form'
import { MarketplaceGlyph } from './marketplace-glyphs'
import { connectOpenMetadata, setOpenMetadataToken } from './marketplace-host-rpc'
import {
  MarketplaceAppHeader,
  MarketplaceNotice,
  MarketplacePending,
  MarketplaceScreenFrame
} from './marketplace-screen-frame'
import { marketplaceStyles as styles } from './marketplace-styles'
import { useMarketplaceHostData, useMarketplaceHostName } from './use-marketplace-host-data'

function agentEntryText(entry: string): string | null {
  switch (entry) {
    case 'set':
      return 'Connected'
    case 'missing':
      return 'Not connected'
    case 'unreadable':
      return 'Config unreadable'
    case 'built-in':
      return 'Built in'
    default:
      return null
  }
}

export function MarketplaceOpenMetadataScreen({ hostId }: { hostId: string | undefined }) {
  const router = useRouter()
  const hostName = useMarketplaceHostName(hostId)
  const { client, state } = useHostClient(hostId)
  const connected = state === 'connected'
  const data = useMarketplaceHostData(client, connected)
  const [replacing, setReplacing] = useState(false)
  const app: MarketplaceAppStatus | null =
    data.apps?.find((entry) => entry.id === 'openmetadata') ?? null

  return (
    <MarketplaceScreenFrame title="OpenMetadata" onBack={() => router.back()}>
      {!data.loaded ? <MarketplacePending connected={connected} hostName={hostName} /> : null}
      {data.loaded && app === null ? (
        <MarketplaceNotice bad text={`Could not load from ${hostName}.`} />
      ) : null}
      {app !== null ? (
        <>
          <MarketplaceAppHeader
            tile={<MarketplaceGlyph name="db" size={26} />}
            title="OpenMetadata"
            titleSize={16}
            subtitle="Your company's context center, as an MCP server for your agents."
            status={
              app.connected
                ? { tone: 'ok', text: `Connected on ${hostName}` }
                : { tone: 'warn', text: `Not connected on ${hostName}` }
            }
          />

          {!app.connected ? (
            <View style={styles.card}>
              <MarketplaceCredentialForm
                withUrl
                submitLabel="Connect"
                onSubmit={(values) =>
                  client === null
                    ? Promise.resolve({ ok: false, reason: 'unreachable' } as const)
                    : connectOpenMetadata(client, values)
                }
                onSaved={() => data.refresh()}
              />
            </View>
          ) : null}

          <Text style={styles.label}>Agents on {hostName}</Text>
          <View style={styles.card}>
            {app.agents.map((row, index) => {
              const text = agentEntryText(row.entry)
              return (
                <View key={row.agent} style={[styles.row, index === 0 && styles.rowFirst]}>
                  <CatalogIcon icon={{ kind: 'agent', agentId: row.agent }} size={16} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{catalogAgentName(row.agent)}</Text>
                    {text !== null ? <Text style={styles.rowMeta}>{text}</Text> : null}
                  </View>
                </View>
              )
            })}
          </View>

          <View style={styles.card}>
            <View style={[styles.row, styles.rowFirst]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Credentials</Text>
                <Text style={styles.rowMeta}>
                  {app.credential?.stored === true ? `Set on ${hostName}. Never shown.` : 'Not set'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={[styles.actionBase, styles.actionGhost]}
                onPress={() => setReplacing((open) => !open)}
              >
                <Text style={[styles.actionText, styles.actionGhostText]}>Replace</Text>
              </Pressable>
            </View>
            {replacing ? (
              <MarketplaceCredentialForm
                withUrl={false}
                submitLabel="Save"
                onSubmit={(values) =>
                  client === null
                    ? Promise.resolve({ ok: false, reason: 'unreachable' } as const)
                    : setOpenMetadataToken(client, values.token)
                }
                onSaved={() => {
                  setReplacing(false)
                  data.refresh()
                }}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </MarketplaceScreenFrame>
  )
}
