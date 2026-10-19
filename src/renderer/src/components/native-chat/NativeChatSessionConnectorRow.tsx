import {
  BookOpen,
  Brain,
  Database,
  FolderOpen,
  Github,
  Globe,
  Network,
  Plug,
  type LucideIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AgentSessionConnectorSnapshot } from '../../../../shared/agent-session-connectors'
import { humanizeServerName } from '../../../../shared/native-chat-tool-identity'

/** Well-known servers, matched by a fragment of their name; any other server gets the plug. */
const KNOWN_CONNECTORS = [
  'codegraph',
  'context7',
  'engram',
  'openmetadata',
  'github',
  'playwright',
  'filesystem'
] as const
export type ConnectorIconKey = (typeof KNOWN_CONNECTORS)[number] | 'plug'

const CONNECTOR_ICONS: Record<ConnectorIconKey, LucideIcon> = {
  codegraph: Network,
  context7: BookOpen,
  engram: Brain,
  openmetadata: Database,
  github: Github,
  playwright: Globe,
  filesystem: FolderOpen,
  plug: Plug
}

export function connectorIconKey(name: string): ConnectorIconKey {
  const lowered = name.toLowerCase()
  return KNOWN_CONNECTORS.find((known) => lowered.includes(known)) ?? 'plug'
}

/** The same provider observation in the compact card and its expanded detail; the raw key stays on hover. */
export function NativeChatSessionConnectorRow({
  connector,
  expanded = false
}: {
  connector: AgentSessionConnectorSnapshot['servers'][number]
  expanded?: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  const labels = {
    connected: t('components.nativeChatSummary.connectorStatus.connected', 'Connected'),
    failed: t('components.nativeChatSummary.connectorStatus.failed', 'Failed'),
    'needs-auth': t('components.nativeChatSummary.connectorStatus.needs-auth', 'Sign-in required'),
    pending: t('components.nativeChatSummary.connectorStatus.pending', 'Pending'),
    disabled: t('components.nativeChatSummary.connectorStatus.disabled', 'Disabled'),
    unknown: t('components.nativeChatSummary.connectorStatus.unknown', 'Unknown'),
    configured: t(
      'components.nativeChatSummary.connectorStatus.configured',
      'Configured (connection not reported)'
    )
  }
  const label =
    connector.configured && connector.status === 'unknown'
      ? labels.configured
      : labels[connector.status]
  const Icon = CONNECTOR_ICONS[connectorIconKey(connector.name)]
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon aria-hidden className="mt-0.5 size-3 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={expanded ? 'break-words' : 'truncate'} title={connector.name}>
          {humanizeServerName(connector.name)} · {label}
        </p>
        {expanded && connector.error ? (
          <p className="break-words text-muted-foreground">{connector.error}</p>
        ) : null}
      </div>
    </div>
  )
}
