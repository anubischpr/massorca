import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  joinNames,
  type PrototypeSystemCard
} from '../../../../shared/prototype-design-system-card'
import type { PrototypeDesignSystemMode } from '../../../../shared/prototype-design-system-files'

/**
 * Asks, before a prototype request is made, whether it uses the chat's design system: an existing system is
 * used or reviewed first, and a project without one is proposed one or skipped.
 */
export function NativeChatPrototypeSystemCard({
  card,
  count,
  agentName,
  onChoose,
  onReview
}: {
  card: PrototypeSystemCard
  /** The prototypes the request makes; the line says what the directions do with the system. */
  count: number
  agentName: string
  onChoose: (mode: PrototypeDesignSystemMode) => void
  /** Opens the project's Design system view; the card stays up until it is answered. */
  onReview: () => void
}): React.JSX.Element {
  const title =
    card.kind === 'existing'
      ? translate('components.prototypes.designSystem.title', 'Design system · {{project}}', {
          project: card.projectName
        })
      : translate('components.prototypes.ask.systemNoneTitle', 'No design system in {{project}}', {
          project: card.projectName
        })
  return (
    <div className="min-h-0 shrink overflow-hidden bg-chat-canvas">
      <div className="mx-auto flex w-full max-w-(--chat-content-max-width) px-3 pt-2 pb-1 sm:px-4">
        <div
          role="group"
          aria-label={title}
          data-native-chat-prototype-system-card="true"
          className="flex w-full max-w-[420px] flex-col gap-2.5 rounded-xl border border-input bg-card p-3.5"
        >
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">
            {card.kind === 'existing'
              ? existingLine(card, count)
              : translate(
                  'components.prototypes.ask.systemNoneLine',
                  '{{agent}} will propose one first: tokens, components and 2 palettes. You review it before any direction is made.',
                  { agent: agentName }
                )}
          </span>
          {card.kind === 'existing' ? (
            <span className="flex gap-1.5">
              {card.swatches.map((hex, index) => (
                <span
                  key={`${index}:${hex}`}
                  aria-hidden="true"
                  className="size-[18px] rounded-sm border border-border"
                  style={{ background: hex }}
                />
              ))}
            </span>
          ) : null}
          {card.kind === 'existing' ? (
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => onChoose('use')}>
                {translate('components.prototypes.ask.systemUse', 'Use it')}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={onReview}>
                {translate('components.prototypes.ask.systemReview', 'Review first')}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => onChoose('propose')}>
                {translate('components.prototypes.ask.systemPropose', 'Propose one first')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onChoose('skip')}
              >
                {translate('components.prototypes.ask.systemSkip', 'Skip')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** "v2 · 24 tokens from main.css and STYLEGUIDE.md. Both directions will use it.", the source part left out with no source. */
function existingLine(
  card: Extract<PrototypeSystemCard, { kind: 'existing' }>,
  count: number
): string {
  const from =
    card.sourceNames.length === 0
      ? ''
      : ` ${translate('components.prototypes.ask.systemFrom', 'from {{sources}}', {
          sources: joinNames(
            card.sourceNames,
            translate('components.prototypes.ask.systemAnd', 'and')
          )
        })}`
  return translate(
    'components.prototypes.ask.systemSummary',
    'v{{version}} · {{tokens}} tokens{{from}}. {{directions}}',
    { version: card.version, tokens: card.tokenCount, from, directions: directionsLine(count) }
  )
}

function directionsLine(count: number): string {
  if (count === 1) {
    return translate('components.prototypes.ask.systemDirectionOne', 'The direction will use it.')
  }
  if (count === 2) {
    return translate('components.prototypes.ask.systemDirectionTwo', 'Both directions will use it.')
  }
  return translate(
    'components.prototypes.ask.systemDirectionAll',
    'All {{count}} directions will use it.',
    {
      count
    }
  )
}
