import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import { buildDesignSystemUpdateMessage } from '../../../../shared/prototype-design-system-message'
import { designSystemRebuildSetsOf } from '../../../../shared/prototype-design-system-rebuild'
import {
  designSystemDraftCount,
  designSystemDraftGroups
} from '../../../../shared/prototype-design-system-draft'
import { prototypeTitle } from '../../../../shared/prototype-list-model'
import { prototypeAgentLabel } from './prototype-labels'
import { keyedEntries } from './prototype-entry-keys'
import type { DesignSystemPanelProps } from './prototype-design-system-props'
import { draftImagesPending } from '../../../../shared/prototype-design-system-view-state'
import {
  PrototypeDesignSystemAttachButton,
  PrototypeDesignSystemImageList
} from './PrototypeDesignSystemImages'

/**
 * The draft of the aside: the items the edits made, the rebuild option when sets are built on this version,
 * "Anything else", Send, and the line that says what one message carries.
 */
export function PrototypeDesignSystemDraft({
  system,
  content,
  state,
  update,
  target,
  rebuildSets,
  runSend,
  images
}: DesignSystemPanelProps): React.JSX.Element {
  const base = { tokens: content.tokens, components: content.components }
  const groups = designSystemDraftGroups(base, state.draft)
  const count = designSystemDraftCount(base, state.draft)
  const agent = target === undefined ? (system.agent ?? '') : prototypeAgentLabel(target.agent)
  const next = system.version + 1
  const titles = rebuildSets.map((set) => prototypeTitle(set)).join(', ')
  const rebuilding = state.rebuild && rebuildSets.length > 0
  const nothingToSend = count === 0 && state.freeText.trim() === '' && state.images.length === 0
  const send = (): void => {
    const rebuild = rebuilding ? designSystemRebuildSetsOf(rebuildSets) : []
    const message = buildDesignSystemUpdateMessage({
      currentVersion: system.version,
      groups,
      rebuild,
      freeText: state.freeText,
      ...(system.folderPath !== undefined ? { systemFolder: system.folderPath } : {})
    })
    void runSend('draft', message.sentText)
  }
  return (
    <div className="flex flex-1 flex-col gap-2.5 p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">
          {translate('components.prototypes.draftTitle', 'Draft for {{agent}}', { agent })}
        </span>
        <span className="text-xs text-muted-foreground">
          {translate('components.prototypes.draftCount', '{{count}} items', {
            count
          })}
        </span>
      </div>
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-muted-foreground">{group.title}</span>
          {keyedEntries(group.items, (item) => `${item.label}:${item.text}`).map(
            ({ key, entry: item }) => (
              <div
                key={key}
                className="flex items-start gap-2 rounded-lg border border-border p-1.5"
              >
                <span className="mt-px shrink-0 rounded border border-border px-1 text-[10px]">
                  {item.label}
                </span>
                <span className="text-xs leading-snug">{item.text}</span>
              </div>
            )
          )}
        </div>
      ))}
      {rebuildSets.length === 0 ? null : (
        <label className="flex items-start gap-2 text-xs leading-snug text-foreground">
          <Checkbox
            checked={state.rebuild}
            onCheckedChange={(checked) =>
              update((latest) => ({ ...latest, rebuild: checked === true }))
            }
            className="mt-0.5"
          />
          <span>
            {translate(
              'components.prototypes.designSystem.rebuildSets',
              'Also rebuild the sets built on v{{version}} ({{titles}}) with the new tokens and components',
              { version: system.version, titles }
            )}
          </span>
        </label>
      )}
      <div className="flex items-center justify-between">
        <label
          htmlFor="design-system-anything-else"
          className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          {translate('components.prototypes.anythingElse', 'Anything else')}
        </label>
        <PrototypeDesignSystemAttachButton controls={images} />
      </div>
      <textarea
        id="design-system-anything-else"
        rows={3}
        value={state.freeText}
        placeholder={translate(
          'components.prototypes.designSystem.anythingPlaceholder',
          'Tone, brand direction, anything a token can’t express…'
        )}
        onChange={(event) => {
          const text = event.target.value
          update((latest) => ({ ...latest, freeText: text }))
        }}
        className="resize-y rounded-lg border border-border bg-input p-2 text-[13px] text-foreground"
      />
      <PrototypeDesignSystemImageList images={state.images} controls={images} />
      <Button
        className="mt-auto"
        disabled={
          state.sending || target === undefined || nothingToSend || draftImagesPending(state)
        }
        onClick={send}
      >
        {translate('components.prototypes.sendButton', 'Send to {{agent}}', {
          agent
        })}
      </Button>
      {state.failed === 'draft' ? (
        <span role="alert" className="text-[11px] text-destructive">
          {translate(
            'components.prototypes.sendFailed',
            "Couldn't send: the chat is no longer active. Your draft is kept."
          )}
        </span>
      ) : null}
      <span className="text-[11px] leading-normal text-muted-foreground">
        {translate(
          'components.prototypes.designSystem.footer',
          'One message: “Update the design system to v{{next}}.” + every token and component change{{rebuild}}. The agent updates tokens.json, components.html and system.md.',
          {
            next,
            rebuild: rebuilding
              ? translate(
                  'components.prototypes.designSystem.rebuildSuffix',
                  ' + “Rebuild {{titles}} on v{{next}}.”',
                  { titles, next }
                )
              : ''
          }
        )}
      </span>
    </div>
  )
}
