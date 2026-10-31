import { translate } from '@/i18n/i18n'
import {
  colorHexOf,
  DESIGN_ELEMENT_ROOT,
  DESIGN_ELEMENT_ROWS,
  originalTokenValueOf,
  type DesignElementEdit,
  type DesignRow,
  type TokenRow
} from '../../../../shared/prototype-design-system-element'
import {
  draftElementEdits,
  draftElementOf,
  setDraftElementNote,
  setDraftElementValue
} from '../../../../shared/prototype-design-system-draft'
import type { ComponentSection } from '../../../../shared/prototype-design-system-components'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import { FONT_SIZE_BOUNDS, SIZE_PX_BOUNDS } from '../../../../shared/prototype-number-input'
import type { DesignElementPick } from '../../../../shared/prototype-design-system-view-state'
import {
  AlignRow,
  NumberRow,
  rowLabelOf,
  SizeRow,
  StyleRow,
  TokenChipRow
} from './PrototypeDesignSystemRows'
import type { DesignSystemPanelProps } from './prototype-design-system-props'

/**
 * The aside of one picked element: its breadcrumb back up the component, the properties its kind offers
 * (each showing its file value until the draft changes it), and the note that applies to this element.
 */
export function PrototypeDesignSystemElement({
  section,
  pick,
  content,
  state,
  update
}: DesignSystemPanelProps & {
  section: ComponentSection
  pick: DesignElementPick
}): React.JSX.Element {
  const { locator, label, readout } = pick
  const isRoot = locator === DESIGN_ELEMENT_ROOT
  const kind = isRoot ? 'root' : readout.kind
  const tokens = content.tokens
  const edits = draftElementEdits(state.draft, section, locator)
  const commit = <Prop extends keyof DesignElementEdit>(
    prop: Prop,
    value: DesignElementEdit[Prop],
    original: DesignElementEdit[Prop]
  ): void => {
    update((latest) => ({
      ...latest,
      draft: setDraftElementValue(latest.draft, section, locator, label, prop, value, original)
    }))
  }
  const tokenRow = (
    row: TokenRow,
    group: string,
    options: readonly DesignToken[] = tokens.filter((token) => token.group === group)
  ): React.JSX.Element => {
    const original = originalTokenValueOf(row, readout, tokens)
    const value = edits[row] ?? original
    // A typed hex that equals the original's color is the original, whether that is a token or a raw hex.
    const hexOf = (text: string): string =>
      colorHexOf(
        text.startsWith('#') ? text : (tokens.find((token) => token.id === text)?.value ?? '')
      ) ?? '#000000'
    const originalHex = hexOf(original)
    const hex = hexOf(value)
    return (
      <TokenChipRow
        key={row}
        label={rowLabelOf(row)}
        tokens={options}
        value={value}
        onPick={(tokenId) => commit(row, tokenId, original)}
        customColor={
          group === 'color'
            ? {
                hex,
                onHex: (next) =>
                  commit(row, colorHexOf(next) === originalHex ? original : next, original)
              }
            : undefined
        }
      />
    )
  }
  const rowElement = (row: DesignRow): React.JSX.Element | null => {
    switch (row) {
      case 'fill':
      case 'color':
      case 'border':
        return tokenRow(row, 'color')
      case 'radius':
        return tokenRow(row, 'radius')
      case 'shadow':
        return tokenRow(row, 'shadow')
      case 'font':
        return tokenRow(
          row,
          'type',
          tokens.filter((token) => token.group === 'type' && token.type === 'fontFamily')
        )
      case 'borderWidth':
        return (
          <NumberRow
            key={row}
            label={rowLabelOf(row)}
            ariaLabel={rowLabelOf(row)}
            value={edits.borderWidth ?? readout.borderWidth}
            bounds={SIZE_PX_BOUNDS}
            unit="px"
            onCommit={(value) => commit('borderWidth', value, readout.borderWidth)}
          />
        )
      case 'width':
      case 'height':
        return (
          <SizeRow
            key={row}
            label={rowLabelOf(row)}
            ariaLabel={rowLabelOf(row)}
            unitLabel={rowLabelOf(row)}
            size={edits[row] ?? readout[row]}
            onCommit={(size) => commit(row, size, readout[row])}
          />
        )
      case 'padding':
      case 'gap':
        return (
          <NumberRow
            key={row}
            label={rowLabelOf(row)}
            ariaLabel={rowLabelOf(row)}
            value={edits[row] ?? readout[row]}
            bounds={SIZE_PX_BOUNDS}
            unit="px"
            onCommit={(value) => commit(row, value, readout[row])}
          />
        )
      case 'fontSize':
        return (
          <NumberRow
            key={row}
            label={rowLabelOf(row)}
            ariaLabel={rowLabelOf(row)}
            value={edits.fontSize ?? readout.fontSize}
            bounds={FONT_SIZE_BOUNDS}
            unit="px"
            onCommit={(value) => commit('fontSize', value, readout.fontSize)}
          />
        )
      case 'lineHeight':
        return (
          <NumberRow
            key={row}
            label={rowLabelOf(row)}
            ariaLabel={rowLabelOf(row)}
            value={edits.lineHeight ?? readout.lineHeight}
            bounds={{ min: 0, max: 10 }}
            onCommit={(value) => commit('lineHeight', value, readout.lineHeight)}
          />
        )
      case 'style':
        return (
          <StyleRow
            key={row}
            bold={edits.bold ?? readout.bold}
            italic={edits.italic ?? readout.italic}
            underline={edits.underline ?? readout.underline}
            onToggle={(flag) => commit(flag, !(edits[flag] ?? readout[flag]), readout[flag])}
          />
        )
      case 'align':
        return (
          <AlignRow
            key={row}
            align={edits.align ?? readout.align}
            onPick={(align) => commit('align', align, readout.align)}
          />
        )
    }
  }
  const crumbs = pick.trail.flatMap((item, index) =>
    item.locator === DESIGN_ELEMENT_ROOT ? [] : [{ item, index }]
  )
  const note = draftElementOf(state.draft, section, locator)?.note ?? ''
  const hasText = kind === 'text' || kind === 'button' || kind === 'badge'
  const groups = DESIGN_ELEMENT_ROWS[kind].map((group) => (
    <div key={group.heading} className="flex flex-col gap-1.5 border-t border-border pt-2.5">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {translate('components.prototypes.designSystem.editGroup', 'Edit · {{group}}', {
          group: group.heading
        })}
      </span>
      {group.rows.map((row) => rowElement(row))}
    </div>
  ))
  // The whole component's Layout rows: its note and removal stay with the component editor beside them.
  if (isRoot) {
    return <div className="flex flex-col gap-2.5 border-b border-border p-3">{groups}</div>
  }
  return (
    <div className="flex flex-col gap-2.5 border-b border-border p-3">
      <nav
        aria-label={translate('components.prototypes.designSystem.breadcrumb', 'Breadcrumb')}
        className="flex flex-wrap items-center gap-0.5 text-xs text-muted-foreground"
      >
        <button
          type="button"
          onClick={() =>
            update((latest) => ({
              ...latest,
              selection: { kind: 'component', name: section.name }
            }))
          }
          className="rounded px-1 py-0.5 hover:bg-accent"
        >
          {section.name}
        </button>
        {crumbs.map(({ item, index }) => (
          <span key={item.locator} className="flex items-center gap-0.5">
            <span aria-hidden="true">›</span>
            <button
              type="button"
              onClick={() =>
                update((latest) => ({
                  ...latest,
                  selection: {
                    kind: 'component',
                    name: section.name,
                    element: {
                      locator: item.locator,
                      label: item.label,
                      readout: item.readout,
                      trail: pick.trail.slice(0, index)
                    }
                  }
                }))
              }
              className="rounded px-1 py-0.5 hover:bg-accent"
            >
              {item.label}
            </button>
          </span>
        ))}
        <span className="flex items-center gap-0.5">
          <span aria-hidden="true">›</span>
          <span aria-current="true" className="px-1 py-0.5 font-semibold text-foreground">
            {label}
          </span>
        </span>
      </nav>
      {groups}
      {hasText ? (
        <span className="text-[11px] text-muted-foreground">
          {translate(
            'components.prototypes.designSystem.textHint',
            'Text is never edited here: only its style is.'
          )}
        </span>
      ) : null}
      <label
        htmlFor="design-system-element-note"
        className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {translate('components.prototypes.designSystem.noteLabel', 'Note — anything Edit can’t do')}
      </label>
      <textarea
        id="design-system-element-note"
        rows={2}
        value={note}
        placeholder={translate(
          'components.prototypes.designSystem.notePlaceholder',
          'Describe a change: behavior, animation, structure…'
        )}
        onChange={(event) => {
          const text = event.target.value
          update((latest) => ({
            ...latest,
            draft: setDraftElementNote(latest.draft, section, locator, label, text)
          }))
        }}
        className="resize-none rounded-md border border-border bg-input p-2 text-[13px] text-foreground"
      />
      <span className="text-[11px] text-muted-foreground">
        {translate(
          'components.prototypes.designSystem.elementFooter',
          'Every change joins the draft on its own. Put a value back to remove it.'
        )}
      </span>
    </div>
  )
}
