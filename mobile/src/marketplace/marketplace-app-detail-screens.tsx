import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Check } from 'lucide-react-native'
import { useHostClient } from '../transport/client-context'
import { colors } from '../theme/mobile-theme'
import {
  catalogAgentDesc,
  catalogAgentName,
  isAgentDetected,
  isCatalogAgentId
} from './marketplace-catalog-model'
import { CatalogIcon } from './marketplace-catalog-row'
import { MarketplaceGlyph } from './marketplace-glyphs'
import {
  MarketplaceAppHeader,
  MarketplaceNotice,
  MarketplacePending,
  MarketplaceScreenFrame
} from './marketplace-screen-frame'
import { marketplaceStyles as styles } from './marketplace-styles'
import { useMarketplaceHostData, useMarketplaceHostName } from './use-marketplace-host-data'

// Why: these screens are the board's Git, GitHub and agent details, read-only: the host exposes no install or sign-in call to the phone yet.
function useDetailHost(hostId: string | undefined) {
  const hostName = useMarketplaceHostName(hostId)
  const { client, state } = useHostClient(hostId)
  const connected = state === 'connected'
  const data = useMarketplaceHostData(client, connected)
  return { hostName, connected, data }
}

export function MarketplaceGitScreen({ hostId }: { hostId: string | undefined }) {
  const router = useRouter()
  const { hostName, connected, data } = useDetailHost(hostId)
  const installed = data.tools?.git === true

  return (
    <MarketplaceScreenFrame title="Git" onBack={() => router.back()}>
      {!data.loaded ? <MarketplacePending connected={connected} hostName={hostName} /> : null}
      {data.loaded && data.tools === null ? (
        <MarketplaceNotice bad text={`Could not load from ${hostName}.`} />
      ) : null}
      {data.tools !== null ? (
        <>
          <MarketplaceAppHeader
            tile={<MarketplaceGlyph name="branch" size={26} />}
            title="Git"
            status={
              installed
                ? { tone: 'ok', text: `Installed on ${hostName}` }
                : { tone: 'warn', text: `Not installed on ${hostName}` }
            }
          />
          <Text style={styles.note}>
            Keeps versions of files and code. MassOrca and your agents use it on each host.
          </Text>
          {!installed ? (
            <Text style={styles.note}>Installing Git from this phone is not available yet.</Text>
          ) : null}
          <Text style={styles.label}>Used in MassOrca</Text>
          <View style={styles.card}>
            <UsageRow
              first
              name="Workspaces"
              desc="Git projects, worktrees, changes and commits."
            />
            <UsageRow
              name="Versions in Bot teams"
              desc="Keeps each saved version of a team's files."
            />
            <UsageRow name="Agents" desc="Agents run git in their terminals on this host." />
          </View>
        </>
      ) : null}
    </MarketplaceScreenFrame>
  )
}

function UsageRow({ name, desc, first = false }: { name: string; desc: string; first?: boolean }) {
  return (
    <View style={[styles.row, first && styles.rowFirst]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowMeta}>{desc}</Text>
      </View>
    </View>
  )
}

export function MarketplaceGitHubScreen({ hostId }: { hostId: string | undefined }) {
  const router = useRouter()
  const { hostName, connected, data } = useDetailHost(hostId)
  const app = data.apps?.find((entry) => entry.id === 'github') ?? null

  return (
    <MarketplaceScreenFrame title="GitHub" onBack={() => router.back()}>
      {!data.loaded ? <MarketplacePending connected={connected} hostName={hostName} /> : null}
      {data.loaded && app === null ? (
        <MarketplaceNotice bad text={`Could not load from ${hostName}.`} />
      ) : null}
      {app !== null ? (
        <>
          <MarketplaceAppHeader
            tile={<MarketplaceGlyph name="github" size={26} />}
            title="GitHub"
            status={
              app.connected
                ? { tone: 'ok', text: `Connected on ${hostName}` }
                : { tone: 'warn', text: `Not connected on ${hostName}` }
            }
          />
          <Text style={styles.note}>
            Lets agents and teams work with your repositories, pull requests and issues.
          </Text>
          <Text style={styles.note}>
            Signing in to GitHub from this phone is not available yet.
          </Text>
        </>
      ) : null}
    </MarketplaceScreenFrame>
  )
}

export function MarketplaceAgentScreen({
  hostId,
  agentId
}: {
  hostId: string | undefined
  agentId: string | undefined
}) {
  const router = useRouter()
  const { hostName, connected, data } = useDetailHost(hostId)
  if (!isCatalogAgentId(agentId)) {
    return (
      <MarketplaceScreenFrame title="Marketplace" onBack={() => router.back()}>
        {null}
      </MarketplaceScreenFrame>
    )
  }
  const name = catalogAgentName(agentId)
  const detected = isAgentDetected(agentId, data)

  return (
    <MarketplaceScreenFrame title={name} onBack={() => router.back()}>
      {!data.loaded ? <MarketplacePending connected={connected} hostName={hostName} /> : null}
      {data.loaded && data.agentIds === null && data.piRuntimes === null ? (
        <MarketplaceNotice bad text={`Could not load from ${hostName}.`} />
      ) : null}
      <MarketplaceAppHeader
        tile={<CatalogIcon icon={{ kind: 'agent', agentId }} size={30} />}
        title={name}
        subtitle={catalogAgentDesc(agentId)}
      />
      <Text style={styles.label}>Hosts</Text>
      <View style={styles.card}>
        <View style={[styles.row, styles.rowFirst]}>
          <MarketplaceGlyph name="server" size={18} color={colors.textSecondary} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{hostName}</Text>
            <Text style={styles.rowMeta}>{detected ? 'Found' : 'Not installed'}</Text>
          </View>
          {detected ? <Check size={16} color={colors.statusGreen} /> : null}
        </View>
      </View>
      <Text style={styles.note}>
        Installing or managing an agent from this phone is not available yet.
      </Text>
    </MarketplaceScreenFrame>
  )
}
