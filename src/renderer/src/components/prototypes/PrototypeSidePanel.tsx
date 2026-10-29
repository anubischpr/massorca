import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PrototypeDraftField } from '../../../../shared/prototype-draft'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeEditPanel } from './PrototypeEditPanel'
import { prototypeAgentLabel } from './prototype-labels'
import { prototypeTitle } from './prototype-list-model'
import { jumpToDraftItem, setPrompt, type PrototypeSetState } from './prototype-set-state'
import { draftOf } from './prototype-set-view'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** The label a draft item carries: a field name, or "take into" for a note taken on a sibling. */
function itemLabel(field: PrototypeDraftField, letter: string, active: string): string {
  if (letter !== active) {
    return translate('components.prototypes.takeInto', 'take into {{letter}}', { letter: active })
  }
  switch (field) {
    case 'text':
      return translate('components.prototypes.fieldText', 'text')
    case 'color':
      return translate('components.prototypes.fieldTextColor', 'text color')
    case 'bg':
      return translate('components.prototypes.fieldFill', 'fill')
    case 'width':
      return translate('components.prototypes.fieldWidth', 'width')
    case 'height':
      return translate('components.prototypes.fieldHeight', 'height')
    case 'fontSize':
      return translate('components.prototypes.fieldFontSize', 'font size')
    case 'note':
      return translate('components.prototypes.fieldNote', 'note')
  }
}

/** The selection's edit panel, then the draft: its groups, "Anything else", the sent card and Send. */
export function PrototypeSidePanel({
  set,
  state,
  update,
  onSend
}: {
  set: PrototypeListedSet
  state: PrototypeSetState
  update: Update
  onSend: () => void
}): React.JSX.Element {
  const draft = draftOf(state)
  const agent = prototypeAgentLabel(set.agent)
  const chat = set.chatTitle?.trim() ?? ''
  const chatName = chat.length > 0 ? chat : prototypeTitle(set)
  return (
    <>
      <PrototypeEditPanel state={state} update={update} pulseField={state.pulse?.field ?? null} />
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">
            {translate('components.prototypes.draftTitle', 'Draft for {{agent}}', { agent })}
          </span>
          <span className="text-xs text-muted-foreground">
            {translate('components.prototypes.draftCount', '{{count}} items', {
              count: draft.itemCount
            })}
          </span>
        </div>
        {draft.groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-muted-foreground">{group.title}</span>
            {group.items.map((item) => (
              <button
                key={`${item.letter}:${item.pinKey}:${item.field}`}
                type="button"
                onClick={() =>
                  update((latest) =>
                    jumpToDraftItem(latest, {
                      letter: item.letter,
                      pinKey: item.pinKey,
                      field: item.field
                    })
                  )
                }
                className="flex items-start gap-2 rounded-lg border border-border p-1.5 text-left hover:bg-accent"
              >
                <span className="mt-px shrink-0 rounded border border-border px-1 text-[10px]">
                  {itemLabel(item.field, item.letter, state.active)}
                </span>
                <span className="text-xs leading-snug">{item.value}</span>
              </button>
            ))}
          </div>
        ))}
        <label
          htmlFor="prototype-anything-else"
          className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          {translate('components.prototypes.anythingElse', 'Anything else')}
        </label>
        <textarea
          id="prototype-anything-else"
          rows={3}
          value={state.prompt}
          placeholder={translate(
            'components.prototypes.anythingElsePlaceholder',
            'Flow, overall direction, anything a note can’t point at…'
          )}
          onChange={(event) => update((latest) => setPrompt(latest, event.target.value))}
          className="resize-y rounded-lg border border-border bg-input p-2 text-[13px] text-foreground"
        />
        {state.sentMessage === null ? null : (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-2.5"
          >
            <span className="text-xs text-muted-foreground">
              {translate(
                'components.prototypes.sentCard',
                'Sent to {{agent}} · {{chat}} · just now',
                {
                  agent,
                  chat: chatName
                }
              )}
            </span>
            <span className="font-mono text-[11px] whitespace-pre-line">{state.sentMessage}</span>
          </div>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={state.sending}
          className="mt-auto h-9 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {translate('components.prototypes.sendButton', 'Send to {{agent}}', { agent })}
        </button>
        {state.sendFailed ? (
          <span role="alert" className={cn('text-[11px] text-destructive')}>
            {translate(
              'components.prototypes.sendFailed',
              "Couldn't send: the chat is no longer active. Your draft is kept."
            )}
          </span>
        ) : null}
        <span className="text-[11px] leading-normal text-muted-foreground">
          {translate(
            'components.prototypes.draftFooter',
            'Click a draft item to jump to its control. One message: “Iterate on {{active}}.”, every note and edit with its selector and a screenshot, then your text.',
            { active: state.active }
          )}
        </span>
      </div>
    </>
  )
}
