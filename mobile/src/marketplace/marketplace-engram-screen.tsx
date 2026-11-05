import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useHostClient } from '../transport/client-context'
import type {
  MarketplaceAppAgent,
  MarketplaceAppStatus
} from '../../../src/shared/marketplace-apps'
import { CatalogIcon } from './marketplace-catalog-row'
import { MarketplaceCredentialForm } from './marketplace-credential-form'
import { MarketplaceGlyph } from './marketplace-glyphs'
import { setEngramServer } from './marketplace-host-rpc'
import {
  MarketplaceAppHeader,
  MarketplaceNotice,
  MarketplacePending,
  MarketplaceScreenFrame
} from './marketplace-screen-frame'
import { marketplaceStyles as styles } from './marketplace-styles'
import { useMarketplaceHostData, useMarketplaceHostName } from './use-marketplace-host-data'

// Why: the agent copy is the board's description of what MassOrca writes for Engram in each agent.
const ENGRAM_AGENTS: readonly { agent: MarketplaceAppAgent; name: string; desc: string }[] = [
  {
    agent: 'claude',
    name: 'Claude Code',
    desc: 'MCP server · plugin hooks (session start, prompt, stop, subagent stop, before tools) · memory block in CLAUDE.md'
  },
  {
    agent: 'codex',
    name: 'Codex',
    desc: 'MCP server with cloud sync · the same hooks · memory block in AGENTS.md'
  },
  {
    agent: 'gentle-shell',
    name: 'Gentle Shell',
    desc: 'MCP server · instructions carry the memory rules alone (no hooks)'
  }
]

function engramStatus(
  engram: MarketplaceAppStatus,
  hostName: string
): { tone: 'ok' | 'warn'; text: string } {
  const program = engram.program
  if (program === undefined || !program.found) {
    return { tone: 'warn', text: `Not installed on ${hostName}` }
  }
  const version = program.version
  return version !== null && version !== ''
    ? { tone: 'ok', text: `${version} on ${hostName}` }
    : { tone: 'ok', text: `Installed on ${hostName}` }
}

export function MarketplaceEngramScreen({ hostId }: { hostId: string | undefined }) {
  const router = useRouter()
  const hostName = useMarketplaceHostName(hostId)
  const { client, state } = useHostClient(hostId)
  const connected = state === 'connected'
  const data = useMarketplaceHostData(client, connected)
  const [editing, setEditing] = useState(false)
  const engram = data.apps?.find((app) => app.id === 'engram') ?? null

  return (
    <MarketplaceScreenFrame title="Engram" onBack={() => router.back()}>
      {!data.loaded ? <MarketplacePending connected={connected} hostName={hostName} /> : null}
      {data.loaded && engram === null ? (
        <MarketplaceNotice bad text={`Could not load from ${hostName}.`} />
      ) : null}
      {engram !== null ? (
        <>
          <MarketplaceAppHeader
            tile={<MarketplaceGlyph name="brain" size={26} />}
            title="Engram"
            titleSize={16}
            subtitle="Memory your agents keep between sessions."
            status={engramStatus(engram, hostName)}
          />

          <Text style={styles.label}>Agents</Text>
          <View style={styles.card}>
            {ENGRAM_AGENTS.map((row, index) => {
              const entry = engram.agents.find((agent) => agent.agent === row.agent)?.entry
              return (
                <View key={row.agent} style={[styles.row, index === 0 && styles.rowFirst]}>
                  <CatalogIcon icon={{ kind: 'agent', agentId: row.agent }} size={16} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{row.name}</Text>
                    <Text style={styles.rowMeta}>{row.desc}</Text>
                  </View>
                  {entry === 'set' ? (
                    <Text style={[styles.badge, styles.badgeOk]}>On</Text>
                  ) : entry === 'missing' ? (
                    <Text style={styles.badge}>Off</Text>
                  ) : null}
                </View>
              )
            })}
          </View>

          <Text style={styles.label}>Cloud sync</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowFirst]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Cloud sign-in</Text>
                <Text style={styles.rowMeta}>
                  {engram.credential?.stored === true
                    ? `Kept in Engram's folder on ${hostName}. Never shown.`
                    : `Not set on ${hostName}.`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={[styles.actionBase, styles.actionGhost]}
                onPress={() => setEditing((open) => !open)}
              >
                <Text style={[styles.actionText, styles.actionGhostText]}>Replace</Text>
              </Pressable>
            </View>
            {editing ? (
              <MarketplaceCredentialForm
                withUrl
                urlInitial={engram.serverUrl ?? ''}
                submitLabel="Save"
                onSubmit={(values) =>
                  client === null
                    ? Promise.resolve({ ok: false, reason: 'unreachable' } as const)
                    : setEngramServer(client, values)
                }
                onSaved={() => {
                  setEditing(false)
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
