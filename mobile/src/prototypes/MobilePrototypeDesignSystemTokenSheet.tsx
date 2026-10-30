import { Text } from 'react-native'
import { pickerHueOf } from '../../../src/shared/prototype-color'
import {
  draftTokenValue,
  setDraftTokenValue
} from '../../../src/shared/prototype-design-system-draft'
import type { DesignToken } from '../../../src/shared/prototype-design-system-tokens'
import { componentsUsingToken } from '../../../src/shared/prototype-design-system-view'
import { MobilePrototypeColorPicker } from './MobilePrototypeColorPicker'
import { MobilePrototypeColorRow } from './MobilePrototypeColorRow'
import {
  MobilePrototypeDesignSystemSheetFrame,
  designSystemSheetStyles as sheetStyles
} from './MobilePrototypeDesignSystemSheetFrame'
import type { MobileDesignSystemPanelProps } from './mobile-prototype-design-system-props'

/** A color token: where it is used, its original and draft values, a custom color and a hex field. */
export function MobilePrototypeDesignSystemTokenSheet({
  token,
  content,
  state,
  update,
  rebuildSets,
  onClose
}: Pick<MobileDesignSystemPanelProps, 'content' | 'state' | 'update' | 'rebuildSets'> & {
  token: DesignToken
  onClose: () => void
}) {
  const value = draftTokenValue(state.draft, token)
  const commit = (hex: string): void =>
    update((latest) => ({ ...latest, draft: setDraftTokenValue(latest.draft, token, hex) }))
  return (
    <MobilePrototypeDesignSystemSheetFrame
      title={token.id}
      mono
      subtitle={`Used by ${componentsUsingToken(token.id, content.components)} components · ${rebuildSets.length} sets`}
      onClose={onClose}
    >
      <MobilePrototypeColorRow
        accessibility={{
          swatch: (hex) => `Color ${hex}`,
          custom: 'Custom color',
          hex: 'Hex'
        }}
        palette={[...new Set([token.value, value])]}
        value={value}
        pickerOpen={state.pickerOpen}
        onPick={commit}
        onTogglePicker={() =>
          update((latest) => ({
            ...latest,
            pickerOpen: !latest.pickerOpen,
            pickerHue: pickerHueOf(value)
          }))
        }
      />
      {state.pickerOpen ? (
        <MobilePrototypeColorPicker
          label="color"
          value={value}
          hue={state.pickerHue}
          onHue={(hue) => update((latest) => ({ ...latest, pickerHue: hue }))}
          onPick={commit}
          onDone={() => update((latest) => ({ ...latest, pickerOpen: false }))}
        />
      ) : null}
      <Text style={sheetStyles.note}>
        Changes join the draft on their own. Send can also rebuild the sets built on this version.
      </Text>
    </MobilePrototypeDesignSystemSheetFrame>
  )
}
