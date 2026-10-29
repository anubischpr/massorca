import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { NativeChatPrototypeChoice } from '../../../../shared/prototype-request-decision'
import type { NativeChatPrototypeAsk } from './native-chat-prototype-request-store'

const COUNT_CHOICES = [1, 2, 3] as const

/** Asks how many prototypes before a message that asks for them is sent. */
export function NativeChatPrototypeCountCard({
  ask,
  onChoose
}: {
  ask: NativeChatPrototypeAsk
  onChoose: (choice: NativeChatPrototypeChoice) => void
}): React.JSX.Element {
  const title = translate('components.prototypes.ask.title', 'How many prototypes?')
  return (
    <div className="min-h-0 shrink overflow-hidden bg-chat-canvas">
      <div className="mx-auto flex w-full max-w-(--chat-content-max-width) px-3 pt-2 pb-1 sm:px-4">
        <div
          role="group"
          aria-label={title}
          data-native-chat-prototype-count-card="true"
          className="flex w-full max-w-[420px] flex-col gap-2.5 rounded-xl border border-input bg-card p-3.5"
        >
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-sm text-muted-foreground">
            {translate(
              'components.prototypes.ask.description',
              '{{agent}} will make distinct directions so you can compare them.',
              { agent: ask.agentName }
            )}
          </span>
          <div className="flex gap-2">
            {COUNT_CHOICES.map((count) => (
              <Button
                key={count}
                type="button"
                variant={count === ask.defaultCount ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => onChoose({ count })}
              >
                {count}
              </Button>
            ))}
            {ask.keyword ? (
              <Button
                type="button"
                variant="outline"
                className="flex-[2]"
                onClick={() => onChoose('as-typed')}
              >
                {translate('components.prototypes.ask.notAPrototype', 'Not a prototype')}
              </Button>
            ) : null}
          </div>
          {ask.settingAsks ? (
            <span className="text-xs text-muted-foreground">
              {translate(
                'components.prototypes.ask.shownBecause',
                'Shown because Settings › Prototypes is “Ask each time”.'
              )}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
