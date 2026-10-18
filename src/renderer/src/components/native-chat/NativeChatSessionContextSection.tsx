import { useTranslation } from 'react-i18next'
import type { StructuredAgentContextSummary } from '../../../../shared/structured-agent-session-context-usage'
import {
  formatContextPercentage,
  formatContextTokenCount
} from './native-chat-context-usage-summary'
import { NativeChatSessionField, NativeChatSessionSection } from './NativeChatSessionSection'

/** Context occupancy: a percentage when the window is known, otherwise the used tokens alone. */
export function NativeChatSessionContextSection({
  summary
}: {
  summary: StructuredAgentContextSummary | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const title = t('components.nativeChatSummary.context', 'Context')
  const tokensLabel = t('components.nativeChatSummary.tokens', 'tokens')
  if (!summary) {
    const message = t(
      'components.nativeChatSummary.contextUnavailable',
      'The provider has not reported context occupancy.'
    )
    return (
      <NativeChatSessionSection
        title={title}
        summary={t('components.nativeChatSummary.unavailable', 'Unavailable')}
        compact={<p>{message}</p>}
      >
        <p>{message}</p>
      </NativeChatSessionSection>
    )
  }
  const estimate = summary.estimated ? '~' : ''
  const headline =
    summary.percentage !== null
      ? `${estimate}${formatContextPercentage(summary.percentage)}%`
      : `${estimate}${formatContextTokenCount(summary.usedTokens)} ${tokensLabel}`
  return (
    <NativeChatSessionSection title={title} summary={headline}>
      <dl className="space-y-2">
        <NativeChatSessionField
          label={t('components.nativeChatSummary.used', 'Used')}
          value={`${summary.usedTokens.toLocaleString()} ${tokensLabel}`}
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.window', 'Window')}
          value={
            summary.windowTokens !== null
              ? `${summary.windowTokens.toLocaleString()} ${tokensLabel}`
              : t('components.nativeChatSummary.windowUnknown', 'Not reported by the provider.')
          }
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.source', 'Source')}
          value={
            summary.estimated
              ? t(
                  'components.nativeChatSummary.estimated',
                  'Estimated from the last provider response.'
                )
              : t('components.nativeChatSummary.providerReport', 'Reported by the provider.')
          }
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.observed', 'Observed')}
          value={new Date(summary.observedAt).toLocaleTimeString()}
        />
        {summary.categories.map((category) => (
          <NativeChatSessionField
            key={category.name}
            label={category.name}
            value={category.tokens.toLocaleString()}
          />
        ))}
      </dl>
    </NativeChatSessionSection>
  )
}
