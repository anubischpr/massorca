import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { joinDirectionLetters } from '../../../../shared/prototype-merge-message'
import {
  cancelMerge,
  setMergeNote,
  setPartSource,
  togglePart
} from '../../../../shared/prototype-merge-state'
import {
  keptMergeParts,
  mergeMarkOf,
  type PrototypeMergeMark,
  type PrototypeMergeReviewPart,
  type PrototypeMergeState
} from '../../../../shared/prototype-merge-plan'
import type { PrototypeSetState } from '../../../../shared/prototype-set-state'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void
type Review = Extract<PrototypeMergeState, { phase: 'review' }>

const LABEL_CLASS = 'text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'

function markLabel(mark: PrototypeMergeMark): string {
  switch (mark) {
    case 'suggested':
      return translate('components.prototypes.markSuggested', 'suggested')
    case 'changed':
      return translate('components.prototypes.markChanged', 'changed')
    case 'left out':
      return translate('components.prototypes.markLeftOut', 'left out')
  }
}

function PartRow({
  part,
  letters,
  onToggle,
  onSource
}: {
  part: PrototypeMergeReviewPart
  letters: readonly string[]
  onToggle: () => void
  onSource: (letter: string) => void
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-sidebar px-3 py-2.5',
        !part.on && 'opacity-45'
      )}
    >
      <label className="flex min-w-0 flex-[1_1_160px] items-center gap-2">
        <Checkbox checked={part.on} onCheckedChange={onToggle} />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="font-medium">{part.name}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {part.selector}
          </span>
        </span>
      </label>
      <div
        role="group"
        aria-label={translate('components.prototypes.mergeSource', 'Source of {{name}}', {
          name: part.name
        })}
        className="flex rounded-lg border border-border bg-background p-0.5"
      >
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            aria-pressed={part.from === letter}
            onClick={() => onSource(letter)}
            className={cn(
              'h-[26px] min-w-[34px] rounded-md px-2.5 text-xs font-semibold',
              part.from === letter ? 'bg-status-amber text-black' : 'text-muted-foreground'
            )}
          >
            {letter}
          </button>
        ))}
      </div>
      <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
        {markLabel(mergeMarkOf(part))}
      </span>
    </div>
  )
}

/** The merge review: the agent's source for each part, the plan preview, "Anything else" and the send. */
export function PrototypeMergeReview({
  review,
  agent,
  nextLetter,
  sendFailed,
  update,
  onSend
}: {
  review: Review
  agent: string
  /** The letter the merged direction takes. */
  nextLetter: string
  sendFailed: boolean
  update: Update
  onSend: () => void
}): React.JSX.Element {
  const kept = keptMergeParts(review.parts)
  return (
    <div className="scrollbar-sleek flex min-w-0 flex-1 flex-wrap content-start gap-5 overflow-y-auto px-6 py-5">
      <div className="flex max-w-[520px] flex-[1_1_380px] flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {translate('components.prototypes.mergeTitle', 'Merge {{letters}}', {
              letters: joinDirectionLetters(review.letters)
            })}
          </span>
          <span className="text-xs text-muted-foreground">
            {translate(
              'components.prototypes.mergeSubtitle',
              '{{agent}} suggested a source for each part. Change any of them, or leave a part out.',
              { agent }
            )}
          </span>
        </div>
        {review.parts.map((part, index) => (
          <PartRow
            key={`${part.selector}:${index}`}
            part={part}
            letters={review.letters}
            onToggle={() => update((current) => togglePart(current, index))}
            onSource={(letter) => update((current) => setPartSource(current, index, letter))}
          />
        ))}
        <label htmlFor="prototype-merge-note" className={LABEL_CLASS}>
          {translate('components.prototypes.anythingElse', 'Anything else')}
        </label>
        <textarea
          id="prototype-merge-note"
          rows={2}
          value={review.note}
          placeholder={translate(
            'components.prototypes.mergeNotePlaceholder',
            'How the parts should fit together…'
          )}
          onChange={(event) => {
            const { value } = event.target
            update((current) => setMergeNote(current, value))
          }}
          className="resize-y rounded-lg border border-border bg-input p-2 text-[13px] text-foreground"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => update(cancelMerge)}>
            {translate('components.prototypes.mergeCancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={review.sending || kept.length === 0}
            onClick={onSend}
          >
            {translate('components.prototypes.mergeInto', 'Merge into {{letter}}', {
              letter: nextLetter
            })}
          </Button>
        </div>
        {sendFailed ? (
          <span role="alert" className="text-[11px] text-destructive">
            {translate(
              'components.prototypes.sendFailed',
              "Couldn't send: the chat is no longer active. Your draft is kept."
            )}
          </span>
        ) : null}
      </div>
      <div className="flex max-w-[460px] flex-[1_1_320px] flex-col gap-2">
        <span className={LABEL_CLASS}>
          {translate('components.prototypes.mergePlanPreview', '{{letter}} · preview of the plan', {
            letter: nextLetter
          })}
        </span>
        <div className="flex flex-col gap-3 rounded-lg bg-card p-4.5">
          {kept.map((part, index) => (
            <div key={`${part.selector}:${index}`} className="flex items-center gap-2.5">
              <span
                role="img"
                aria-label={part.name}
                className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
              >
                {part.from}
              </span>
              <span className="block h-8 flex-1 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
