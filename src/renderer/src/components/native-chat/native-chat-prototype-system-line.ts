// The one line an existing design system's card says: its version, tokens, sources and what the directions do with it.
import { translate } from '@/i18n/i18n'
import {
  joinNames,
  type PrototypeSystemCard
} from '../../../../shared/prototype-design-system-card'

/** "v2 · 24 tokens from main.css and STYLEGUIDE.md. Both directions will use it.", the source part left out with no source. */
export function existingPrototypeSystemLine(
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
