import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { ComponentSection } from '../../../src/shared/prototype-design-system-components'
import {
  draftComponentState,
  setDraftBinding,
  setDraftNote,
  setDraftVariants,
  toggleDraftRemoved
} from '../../../src/shared/prototype-design-system-draft'
import { removeDraftImage } from '../../../src/shared/prototype-design-system-view-state'
import { colors } from '../theme/mobile-theme'
import {
  MobilePrototypeDesignSystemChip,
  MobilePrototypeDesignSystemSheetFrame,
  designSystemSheetStyles as sheetStyles
} from './MobilePrototypeDesignSystemSheetFrame'
import { MobilePrototypeSheetTabs } from './MobilePrototypeSheetTabs'
import {
  mobileBindingLabel,
  mobileColorBindings,
  mobileColorTokens
} from './mobile-prototype-design-system-model'
import type { MobileDesignSystemPanelProps } from './mobile-prototype-design-system-props'
import { MobilePrototypeDesignSystemImages } from './MobilePrototypeDesignSystemImages'

type Tab = 'edit' | 'note'

const NOTE_LABEL = 'Anything Edit can’t do, for this component'

/** A component: Edit (variants and color bindings) and Note tabs, and its removal. Every change joins the draft. */
export function MobilePrototypeDesignSystemComponentSheet({
  section,
  content,
  state,
  update,
  images,
  onClose
}: Pick<MobileDesignSystemPanelProps, 'content' | 'state' | 'update' | 'images'> & {
  section: ComponentSection
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('edit')
  const { draft } = state
  const variants = draftComponentState(draft, section).variants
  const removed = draft.removed[section.name] === true
  const toggleVariant = (variant: string): void =>
    update((latest) => {
      const current = draftComponentState(latest.draft, section).variants
      const next = current.includes(variant)
        ? current.filter((entry) => entry !== variant)
        : [...current, variant]
      return { ...latest, draft: setDraftVariants(latest.draft, section, next) }
    })
  const bindings = mobileColorBindings(section, draft)
  const colorTokens = mobileColorTokens(content)
  return (
    <MobilePrototypeDesignSystemSheetFrame title={section.name} onClose={onClose}>
      <MobilePrototypeSheetTabs
        tabs={[
          { key: 'edit', label: 'Edit', selected: tab === 'edit', onPress: () => setTab('edit') },
          { key: 'note', label: 'Note', selected: tab === 'note', onPress: () => setTab('note') }
        ]}
      />
      {tab === 'edit' ? (
        <>
          {section.variantOptions.length === 0 ? null : (
            <>
              <Text style={sheetStyles.label}>Variants and states</Text>
              <View style={sheetStyles.chips}>
                {section.variantOptions.map((variant) => (
                  <MobilePrototypeDesignSystemChip
                    key={variant}
                    label={variant}
                    on={variants.includes(variant)}
                    onPress={() => toggleVariant(variant)}
                  />
                ))}
              </View>
            </>
          )}
          {bindings.map(({ prop, boundTo }) => (
            <View key={prop} style={styles.binding}>
              <Text style={sheetStyles.label}>{mobileBindingLabel(prop)}</Text>
              <View style={sheetStyles.chips}>
                {colorTokens.map((option) => (
                  <MobilePrototypeDesignSystemChip
                    key={option.id}
                    label={option.id}
                    mono
                    on={boundTo === option.id}
                    onPress={() =>
                      update((latest) => ({
                        ...latest,
                        draft: setDraftBinding(latest.draft, section, prop, option.id)
                      }))
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        </>
      ) : (
        <>
          <Text style={sheetStyles.label}>{NOTE_LABEL}</Text>
          <TextInput
            accessibilityLabel={NOTE_LABEL}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholder="Describe a change: behavior, animation, structure…"
            placeholderTextColor={colors.textSecondary}
            value={draft.notes[section.name] ?? ''}
            onChangeText={(text) =>
              update((latest) => ({
                ...latest,
                draft: setDraftNote(latest.draft, section.name, text)
              }))
            }
            style={styles.note}
          />
          <MobilePrototypeDesignSystemImages
            images={state.images}
            control={images}
            onRemove={(id) => update((latest) => removeDraftImage(latest, id))}
          />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          update((latest) => ({
            ...latest,
            draft: toggleDraftRemoved(latest.draft, section.name)
          }))
        }
        style={styles.remove}
      >
        <Text style={styles.removeText}>{removed ? 'Undo remove' : 'Remove component'}</Text>
      </Pressable>
      <Text style={sheetStyles.note}>Changes join the draft on their own.</Text>
    </MobilePrototypeDesignSystemSheetFrame>
  )
}

const styles = StyleSheet.create({
  binding: { gap: 12 },
  note: {
    minHeight: 84,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  },
  remove: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.statusRedBorder
  },
  removeText: { color: colors.statusRed, fontSize: 14 }
})
