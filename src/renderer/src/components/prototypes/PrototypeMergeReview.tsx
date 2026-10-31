import { useMemo, useState } from 'react'
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
  chosenSelectorOf,
  keptMergeParts,
  mergeMarkOf,
  type PrototypeMergeMark,
  type PrototypeMergePartKind,
  type PrototypeMergeReviewPart,
  type PrototypeMergeState
} from '../../../../shared/prototype-merge-plan'
import { mergePartAnchor } from '../../../../shared/prototype-merge-preview-document'
import type { PrototypeSetState } from '../../../../shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeMergePreview } from './PrototypeMergePreview'
import {
  composeMergePreview,
  type MergePreviewPlacement,
  type MergePreviewView
} from './prototype-merge-preview-document'
import { usePrototypeDirectionsHtml } from './use-prototype-direction-html'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void
type Review = Extract<PrototypeMergeState, { phase: 'review' }>

const LABEL_CLASS = 'text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'

function markLabel(mark: PrototypeMergeMark, letter: string): string {
  switch (mark) {
    case 'suggested':
      return translate('components.prototypes.markSuggested', 'suggested')
    case 'changed':
      return translate('components.prototypes.markChanged', 'changed')
    case 'left out':
      return translate('components.prototypes.markLeftOut', 'left out')
    case 'only in':
      return translate('components.prototypes.markOnlyIn', 'only in {{letter}}', { letter })
    case 'no preview':
      return translate('components.prototypes.markNoPreview', 'no preview')
  }
}

function groupHeading(kind: PrototypeMergePartKind): string {
  return kind === 'component'
    ? translate('components.prototypes.mergeGroupComponents', 'Components')
    : translate('components.prototypes.mergeGroupSections', 'Sections')
}

function PartRow({
  part,
  letters,
  placement,
  hovered,
  onHover,
  onToggle,
  onSource
}: {
  part: PrototypeMergeReviewPart
  /** The starred letters this part has, as its possible sources. */
  letters: readonly string[]
  placement: MergePreviewPlacement
  hovered: boolean
  onHover: (hovering: boolean) => void
  onToggle: () => void
  onSource: (letter: string) => void
}): React.JSX.Element {
  const mark = mergeMarkOf(part, placement)
  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-sidebar px-2.5 py-1.5',
        hovered && 'border-status-amber',
        !part.on && 'opacity-45'
      )}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <Checkbox checked={part.on} onCheckedChange={onToggle} />
        <span className="shrink-0 font-medium">{part.name}</span>
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          {chosenSelectorOf(part)}
        </span>
      </label>
      <div
        role="group"
        aria-label={translate('components.prototypes.mergeSource', 'Source of {{name}}', {
          name: part.name
        })}
        className="flex shrink-0 rounded-md border border-border bg-background p-px"
      >
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            aria-pressed={part.from === letter}
            disabled={letters.length === 1}
            onClick={() => onSource(letter)}
            className={cn(
              'h-5 min-w-[28px] rounded-sm px-2 text-[11px] font-semibold',
              part.from === letter ? 'bg-status-amber text-black' : 'text-muted-foreground'
            )}
          >
            {letter}
          </button>
        ))}
      </div>
      <span
        className={cn(
          'w-[72px] shrink-0 text-right text-[11px] text-muted-foreground',
          mark === 'no preview' && 'text-status-amber'
        )}
      >
        {markLabel(mark, part.from)}
      </span>
    </div>
  )
}

/** The merge review: the agent's source for each part, the plan preview, "Anything else" and the send. */
export function PrototypeMergeReview({
  set,
  review,
  agent,
  nextLetter,
  sendFailed,
  update,
  onSend
}: {
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId' | 'directions'>
  review: Review
  agent: string
  /** The letter the merged direction takes. */
  nextLetter: string
  sendFailed: boolean
  update: Update
  onSend: () => void
}): React.JSX.Element {
  const kept = useMemo(() => keptMergeParts(review.parts), [review.parts])
  const previewName = translate('components.prototypes.mergePlanPreview', '{{letter}} · preview', {
    letter: nextLetter
  })
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  // The part the user last changed: the preview moves to its section.
  const [revealedId, setRevealedId] = useState<number | null>(null)
  const [view, setView] = useState<MergePreviewView>('desktop')
  const directions = usePrototypeDirectionsHtml(set, review.letters)
  const composition = useMemo(
    () =>
      directions.ready
        ? composeMergePreview({
            htmlByLetter: directions.htmlByLetter,
            parts: kept,
            view,
            unplacedText: (name) =>
              translate(
                'components.prototypes.mergePreviewUnplaced',
                "{{name}}: couldn't be placed in the preview. The agent includes it in the result.",
                { name }
              )
          })
        : null,
    [directions, kept, view]
  )
  const groups = (['section', 'component'] as const).map((kind) => ({
    kind,
    parts: review.parts.filter((part) => part.kind === kind)
  }))
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
        {groups.map((group) =>
          group.parts.length === 0 ? null : (
            <div key={group.kind} className="flex flex-col gap-1">
              <span className={cn(LABEL_CLASS, 'pt-1')}>{groupHeading(group.kind)}</span>
              {group.parts.map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  letters={review.letters.filter((letter) => part.selectors[letter] !== undefined)}
                  placement={composition?.placement[part.id] ?? 'placed'}
                  hovered={hoveredId === part.id}
                  onHover={(hovering) => setHoveredId(hovering ? part.id : null)}
                  onToggle={() => {
                    setRevealedId(part.id)
                    update((current) => togglePart(current, part.id))
                  }}
                  onSource={(letter) => {
                    setRevealedId(part.id)
                    update((current) => setPartSource(current, part.id, letter))
                  }}
                />
              ))}
            </div>
          )
        )}
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
      <PrototypeMergePreview
        name={previewName}
        agent={agent}
        html={composition?.html ?? null}
        anchor={revealedId === null ? null : mergePartAnchor(revealedId)}
        view={view}
        onView={setView}
      />
    </div>
  )
}
