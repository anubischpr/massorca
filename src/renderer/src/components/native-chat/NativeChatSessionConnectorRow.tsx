import { useTranslation } from 'react-i18next'
import type { AgentSessionConnectorSnapshot } from '../../../../shared/agent-session-connectors'

/** The same provider observation in the compact card and its expanded detail. */
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
    unknown: t('components.nativeChatSummary.connectorStatus.unknown', 'Unknown')
  }
  return (
    <div>
      <p className={expanded ? 'break-words' : 'truncate'}>
        {connector.name} · {labels[connector.status]}
      </p>
      {expanded && connector.error ? (
        <p className="break-words text-muted-foreground">{connector.error}</p>
      ) : null}
    </div>
  )
}
