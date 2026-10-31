import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PrototypeSystemCard } from '../../../../shared/prototype-design-system-card'
import type { PrototypeDesignSystemMode } from '../../../../shared/prototype-design-system-files'
import { delegationDesignSystemModes } from '../../../../shared/delegation-prototype-choices'
import { existingPrototypeSystemLine } from './native-chat-prototype-system-line'

/** How many prototypes the task asks for; the highlighted count is the one the answer sends. */
export function DelegationCountChoices({
  choices,
  highlighted,
  disabled,
  onChoose
}: {
  choices: readonly number[]
  highlighted: number
  disabled: boolean
  onChoose: (count: number) => void
}): React.JSX.Element {
  const title = translate('components.prototypes.ask.title', 'How many prototypes?')
  return (
    <div role="group" aria-label={title} className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="flex gap-2">
        {choices.map((count) => (
          <Button
            key={count}
            type="button"
            variant={count === highlighted ? 'default' : 'outline'}
            aria-pressed={count === highlighted}
            className="flex-1"
            disabled={disabled}
            onClick={() => onChoose(count)}
          >
            {count}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * What the child does with the project's design system, asked as the direct prototype request asks it: an
 * existing system is used, or reviewed first (which opens it and answers nothing); a project without one is
 * proposed one or skips it. The highlighted choice is the one the answer sends.
 */
export function DelegationDesignSystemChoices({
  card,
  count,
  highlighted,
  disabled,
  onChoose,
  onReview
}: {
  card: PrototypeSystemCard
  /** The prototypes the task makes, which the line says use the system. */
  count: number
  highlighted: PrototypeDesignSystemMode
  disabled: boolean
  onChoose: (mode: PrototypeDesignSystemMode) => void
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
    <div role="group" aria-label={title} className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {card.kind === 'existing' ? (
        <p className="text-xs text-muted-foreground">{existingPrototypeSystemLine(card, count)}</p>
      ) : null}
      <div className="flex gap-2">
        {delegationDesignSystemModes(card).map((mode) => (
          <Button
            key={mode}
            type="button"
            variant={mode === highlighted ? 'default' : 'outline'}
            aria-pressed={mode === highlighted}
            className="flex-1"
            disabled={disabled}
            onClick={() => onChoose(mode)}
          >
            {designSystemModeLabel(mode)}
          </Button>
        ))}
        {card.kind === 'existing' ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={disabled}
            onClick={onReview}
          >
            {translate('components.prototypes.ask.systemReview', 'Review first')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function designSystemModeLabel(mode: PrototypeDesignSystemMode): string {
  switch (mode) {
    case 'use':
      return translate('components.prototypes.ask.systemUse', 'Use it')
    case 'propose':
      return translate('components.prototypes.ask.systemPropose', 'Propose one first')
    case 'skip':
      return translate('components.prototypes.ask.systemSkip', 'Skip')
  }
}
