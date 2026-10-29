import { ScrollView, Text, View } from 'react-native'
import { Folder, FolderGit2, GitBranch, Monitor, Plug, Users } from 'lucide-react-native'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { useNow } from '../hooks/use-now'
import { useHostClient } from '../transport/client-context'
import { colors } from '../theme/mobile-theme'
import { summaryStyles as styles } from './mobile-chat-summary-styles'
import { useMobileChatSurfaceSnapshot, mobileChatSurfaceKey } from './mobile-chat-surface-snapshot'
import { buildMobileChatSummaryModel, chatStatusLine } from './mobile-chat-summary-model'
import {
  environmentTiles,
  type MobileChatEnvironmentIcon,
  type MobileChatEnvironmentTile
} from './mobile-chat-environment'
import {
  useMobileChatEnvironment,
  type MobileChatEnvironmentState
} from './use-mobile-chat-environment'

export type MobileChatSummaryViewProps = {
  hostId: string
  worktreeId: string
  tabId: string
}

/** The chat's Summary body: agent status, the environment it runs in, what it wrote, and what it is
 *  connected to. It reads the chat from the snapshot the session screen publishes for this tab. */
export function MobileChatSummaryView({ hostId, worktreeId, tabId }: MobileChatSummaryViewProps) {
  const snapshot = useMobileChatSurfaceSnapshot(mobileChatSurfaceKey(hostId, worktreeId, tabId))
  const { client } = useHostClient(hostId)
  const environment = useMobileChatEnvironment(client, worktreeId)
  const now = useNow(1_000, snapshot?.working === true)

  if (!snapshot) {
    return (
      <View style={styles.emptyPage}>
        <Text style={styles.emptyTitle}>Open this chat to see its summary</Text>
        <Text style={styles.emptyBody}>The summary follows the chat that is on screen.</Text>
      </View>
    )
  }

  const model = buildMobileChatSummaryModel({ messages: snapshot.messages })
  const status = chatStatusLine({
    working: snapshot.working,
    workingStartedAt: snapshot.workingStartedAt,
    now
  })
  const tiles = tilesFor(environment)
  const connectedCount = model.connectors.length + model.runningSubagents.length

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AgentCard agent={snapshot.agent} title={model.title} model={model.model} status={status} />

      <SheetSectionLabel label="Environment" count={tiles?.length} />
      <EnvironmentBody environment={environment} tiles={tiles} />

      <SheetSectionLabel label="Connected" count={connectedCount} />
      {connectedCount === 0 ? (
        <Text style={styles.emptyLine}>No connectors or running subagents.</Text>
      ) : (
        <View style={styles.chips}>
          {model.connectors.map((connector) => (
            <View key={`connector:${connector.id}`} style={styles.chip}>
              <Plug size={12} color={colors.textSecondary} strokeWidth={2.2} />
              <Text style={styles.chipText} numberOfLines={1}>
                {connector.label}
              </Text>
            </View>
          ))}
          {model.runningSubagents.map((subagent) => (
            <View key={`subagent:${subagent.id}`} style={styles.chip}>
              <Users size={12} color={colors.statusGreen} strokeWidth={2.2} />
              <Text style={styles.chipText} numberOfLines={1}>
                {subagent.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

/** Null while the environment loads, so the section label shows no count yet. */
function tilesFor(state: MobileChatEnvironmentState): MobileChatEnvironmentTile[] | null {
  if (state.kind !== 'ready' || state.environment === null) {
    return null
  }
  return environmentTiles({
    worktree: state.environment.worktree,
    ghAccount: state.environment.ghAccount
  })
}

function AgentCard({
  agent,
  title,
  model,
  status
}: {
  agent: string | null
  title: string | null
  model: string | null
  status: { working: boolean; label: string }
}) {
  return (
    <View style={styles.agentCard}>
      <View style={styles.agentIcon}>
        {agent ? <MobileAgentIcon agentId={agent} size={20} /> : null}
      </View>
      <View style={styles.agentText}>
        <Text style={styles.agentTitle} numberOfLines={2}>
          {title ?? 'New chat'}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, status.working ? styles.dotWorking : styles.dotIdle]} />
          <Text style={styles.statusText}>{status.label}</Text>
          {model ? (
            <Text style={styles.modelText} numberOfLines={1}>
              {model}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

function EnvironmentBody({
  environment,
  tiles
}: {
  environment: MobileChatEnvironmentState
  tiles: MobileChatEnvironmentTile[] | null
}) {
  if (environment.kind === 'loading') {
    return <Text style={styles.emptyLine}>Reading the environment…</Text>
  }
  if (tiles === null) {
    return <Text style={styles.emptyLine}>The environment is not available right now.</Text>
  }
  return (
    <View style={styles.tileGrid}>
      {tiles.map((tile) => (
        <View key={tile.key} style={styles.tile}>
          <View style={styles.tileIcon}>
            <TileGlyph icon={tile.icon} />
          </View>
          <Text style={styles.tileLabel}>{tile.label}</Text>
          <Text style={styles.tileValue} numberOfLines={1}>
            {tile.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

function TileGlyph({ icon }: { icon: MobileChatEnvironmentIcon }) {
  const props = { size: 14, color: colors.textSecondary, strokeWidth: 2.2 }
  switch (icon) {
    case 'account':
      return <Users {...props} />
    case 'project':
      return <FolderGit2 {...props} />
    case 'branch':
      return <GitBranch {...props} />
    case 'folder':
      return <Folder {...props} />
    case 'host':
      return <Monitor {...props} />
  }
}
