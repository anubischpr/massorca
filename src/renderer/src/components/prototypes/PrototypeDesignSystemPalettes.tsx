import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { buildDesignSystemPaletteApproveMessage } from '../../../../shared/prototype-design-system-message'
import {
  chatOfPendingRequest,
  designSystemSectionsOf,
  joinParts,
  paletteTypeParts
} from '../../../../shared/prototype-design-system-view'
import { chosenPaletteOf } from '../../../../shared/prototype-design-system-view-state'
import type { DesignSystemPanelProps } from './prototype-design-system-props'

/**
 * The palette review of a proposed system: its palettes to pick from, the type, radius and spacing they come
 * with, and Approve, which applies the chosen palette to the pending request's directions in its own chat, or
 * Adjust tokens, which opens the Tokens tab.
 */
export function PrototypeDesignSystemPalettes({
  system,
  content,
  state,
  update,
  runSend
}: DesignSystemPanelProps): React.JSX.Element {
  const pending = system.pendingRequest
  const palettes = content.meta.palettes
  const chosen = chosenPaletteOf(state, palettes)
  const parts = paletteTypeParts(designSystemSectionsOf(content.tokens))
  const typeSummary = joinParts(
    [parts.fontFamily, parts.sizes.length > 0 ? parts.sizes.join('/') : null],
    ' '
  )
  const line = joinParts([
    typeSummary.length === 0
      ? null
      : translate('components.prototypes.designSystem.typeSummary', 'Type: {{summary}}', {
          summary: typeSummary
        }),
    parts.radius === null
      ? null
      : translate('components.prototypes.designSystem.typeRadius', 'radius {{value}}', {
          value: parts.radius
        }),
    parts.spacingBase === null
      ? null
      : translate('components.prototypes.designSystem.typeSpacing', 'spacing {{value}}-based', {
          value: parts.spacingBase
        })
  ])
  const approve = (): void => {
    if (chosen === null || pending === undefined) {
      return
    }
    const message = buildDesignSystemPaletteApproveMessage({
      paletteName: chosen.name,
      requestId: pending.requestId
    })
    void runSend('palette', message.sentText, chatOfPendingRequest(pending))
  }
  return (
    <div className="flex flex-col gap-2.5 border-b border-border p-3">
      <span className="font-semibold">
        {translate('components.prototypes.designSystem.pickPalette', 'Pick a palette')}
      </span>
      {palettes.map((palette) => {
        const on = chosen?.id === palette.id
        return (
          <button
            key={palette.id}
            type="button"
            aria-pressed={on}
            onClick={() => update((latest) => ({ ...latest, palette: palette.id }))}
            className={cn(
              'flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 text-left',
              on && 'ring-2 ring-ring'
            )}
          >
            <span className="flex gap-1.5">
              {palette.swatches.map((hex, index) => (
                <span
                  key={`${index}:${hex}`}
                  aria-hidden="true"
                  className="size-[22px] rounded-md border border-border"
                  style={{ background: hex }}
                />
              ))}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{palette.name}</span>
              {palette.note === undefined ? null : (
                <span className="text-xs text-muted-foreground">{palette.note}</span>
              )}
            </span>
          </button>
        )
      })}
      {line.length === 0 ? null : <span className="text-xs text-muted-foreground">{line}</span>}
      <div className="flex gap-1.5">
        <Button
          className="flex-[2]"
          disabled={state.sending || chosen === null || pending === undefined}
          onClick={approve}
        >
          {translate('components.prototypes.designSystem.approve', 'Approve {{name}}', {
            name: chosen?.name ?? ''
          })}
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => update((latest) => ({ ...latest, tab: 'tokens' }))}
        >
          {translate('components.prototypes.designSystem.adjustTokens', 'Adjust tokens')}
        </Button>
      </div>
      {state.failed === 'palette' ? (
        <span role="alert" className="text-[11px] text-destructive">
          {translate(
            'components.prototypes.sendFailed',
            "Couldn't send: the chat is no longer active. Your draft is kept."
          )}
        </span>
      ) : null}
    </div>
  )
}
