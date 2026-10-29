import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { draftTokenValue } from '../../../../shared/prototype-design-system-draft'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import {
  designSystemSectionsOf,
  sampleTextOf,
  spacingBarPixels
} from '../../../../shared/prototype-design-system-view'
import type { DesignSystemPanelProps } from './prototype-design-system-props'

const SECTION_LABEL = 'text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'

/**
 * The Tokens tab: the color grid, the type scale, the spacing bars, the radii, the shadows and the motion.
 * A section is shown only when the system has a token of its group; values are the draft's values.
 */
export function PrototypeDesignSystemTokens({
  content,
  state,
  update
}: DesignSystemPanelProps): React.JSX.Element {
  const sections = designSystemSectionsOf(content.tokens)
  const selectedId = state.selection?.kind === 'token' ? state.selection.id : null
  const valueOf = (token: DesignToken): string => draftTokenValue(state.draft, token)
  const choose = (id: string): void => {
    update((latest) => ({ ...latest, selection: { kind: 'token', id }, pickerOpen: false }))
  }
  const typeTitle =
    sections.fontFamily === null
      ? translate('components.prototypes.designSystem.typeScale', 'Type scale')
      : translate('components.prototypes.designSystem.typeScaleFont', 'Type scale · {{font}}', {
          font: sections.fontFamily
        })
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {sections.color.length === 0 ? null : (
        <div className="flex flex-col gap-2.5">
          <span className={SECTION_LABEL}>
            {translate('components.prototypes.designSystem.color', 'Color')}
          </span>
          <div className="grid grid-cols-4 gap-2.5">
            {sections.color.map((token) => {
              const selected = selectedId === token.id
              return (
                <button
                  key={token.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(token.id)}
                  className={cn(
                    'flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-background p-2 text-left',
                    selected && 'ring-2 ring-ring'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-9 shrink-0 rounded-lg border border-border"
                    style={{ background: valueOf(token) }}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-xs">{token.id}</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {valueOf(token)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sections.type.length === 0 && sections.space.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-6">
          {sections.type.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              <span className={SECTION_LABEL}>{typeTitle}</span>
              {sections.typeScale.map((token) => {
                const selected = selectedId === token.id
                const size = valueOf(token)
                const weight = token.weight === undefined ? '' : `/${token.weight}`
                return (
                  <button
                    key={token.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => choose(token.id)}
                    className={cn(
                      'flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left',
                      selected && 'ring-2 ring-ring'
                    )}
                  >
                    <span
                      className="min-w-0 truncate"
                      style={{ fontSize: size, fontWeight: token.weight }}
                    >
                      {sampleTextOf(token)}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {`${token.id} · ${size}${weight}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {sections.space.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              <span className={SECTION_LABEL}>
                {translate('components.prototypes.designSystem.spacing', 'Spacing')}
              </span>
              {sections.space.map((token) => {
                const selected = selectedId === token.id
                const value = valueOf(token)
                return (
                  <button
                    key={token.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => choose(token.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-1 text-left text-muted-foreground',
                      selected && 'ring-2 ring-ring'
                    )}
                  >
                    <span className="w-16 shrink-0 text-left font-mono text-[11px]">
                      {token.id}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-2.5 rounded-sm bg-muted-foreground/50"
                      style={{ width: spacingBarPixels(value) }}
                    />
                    <span className="font-mono text-[11px]">{value}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {sections.radius.length === 0 &&
      sections.shadow.length === 0 &&
      sections.motion.length === 0 ? null : (
        <div className="grid grid-cols-3 gap-6">
          {sections.radius.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              <span className={SECTION_LABEL}>
                {translate('components.prototypes.designSystem.radius', 'Radius')}
              </span>
              <div className="flex gap-2.5">
                {sections.radius.map((token) => {
                  const selected = selectedId === token.id
                  const radius = valueOf(token)
                  return (
                    <button
                      key={token.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => choose(token.id)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg p-1 text-muted-foreground',
                        selected && 'ring-2 ring-ring'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-10 border-2 border-muted-foreground"
                        style={{ borderRadius: radius }}
                      />
                      <span className="font-mono text-[11px]">{`${token.name} ${radius}`}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {sections.shadow.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              <span className={SECTION_LABEL}>
                {translate('components.prototypes.designSystem.shadow', 'Shadow')}
              </span>
              <div className="flex gap-3.5 p-1.5">
                {sections.shadow.map((token) => (
                  <span
                    key={token.id}
                    aria-hidden="true"
                    className="h-10 w-[54px] rounded-lg bg-card"
                    style={{ boxShadow: token.value }}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {sections.shadow.map((token) => token.id).join(' · ')}
              </span>
            </div>
          )}
          {sections.motion.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              <span className={SECTION_LABEL}>
                {translate('components.prototypes.designSystem.motion', 'Motion')}
              </span>
              {sections.motion.map((token) => (
                <span key={token.id} className="font-mono text-[11px] text-foreground">
                  {`${token.id} · ${token.value}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
