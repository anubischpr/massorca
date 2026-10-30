import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  DESIGN_SYSTEM_ADD_CHOICES,
  addComponentToDraft,
  chooseAddChoice
} from '../../../src/shared/prototype-design-system-view-state'
import { colors } from '../theme/mobile-theme'
import {
  MobilePrototypeDesignSystemChip,
  MobilePrototypeDesignSystemSheetFrame,
  designSystemSheetStyles as sheetStyles
} from './MobilePrototypeDesignSystemSheetFrame'
import type { MobileDesignSystemPanelProps } from './mobile-prototype-design-system-props'

/** "Add a component": a kind chip or a typed description, and Add to draft. */
export function MobilePrototypeDesignSystemAddSheet({
  state,
  update,
  onClose,
  onAdded
}: Pick<MobileDesignSystemPanelProps, 'state' | 'update'> & {
  onClose: () => void
  onAdded: () => void
}) {
  return (
    <MobilePrototypeDesignSystemSheetFrame title="Add a component" onClose={onClose}>
      <View style={sheetStyles.chips}>
        {DESIGN_SYSTEM_ADD_CHOICES.map((choice) => (
          <MobilePrototypeDesignSystemChip
            key={choice}
            label={choice}
            solid
            on={state.addChoice === choice && state.addText === ''}
            onPress={() => update((latest) => chooseAddChoice(latest, choice))}
          />
        ))}
      </View>
      <Text style={sheetStyles.label}>Or describe a custom one</Text>
      <TextInput
        accessibilityLabel="Or describe a custom one"
        placeholder="e.g. phase stepper with a status per step"
        placeholderTextColor={colors.textSecondary}
        value={state.addText}
        onChangeText={(text) => update((latest) => ({ ...latest, addText: text }))}
        style={sheetStyles.input}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          update(addComponentToDraft)
          onAdded()
        }}
        style={styles.add}
      >
        <Text style={styles.addText}>Add to draft</Text>
      </Pressable>
    </MobilePrototypeDesignSystemSheetFrame>
  )
}

const styles = StyleSheet.create({
  add: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.textPrimary
  },
  addText: { color: colors.bgBase, fontSize: 15, fontWeight: '500' }
})
