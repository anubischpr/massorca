import { useState } from 'react'
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, X } from 'lucide-react-native'
import type { PiRowRuntime } from '../../../src/shared/agent-type-label'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  sessionOptionDispatchUnconfirmed,
  type SessionOptionDescriptor,
  type SessionOptionSelectChoice,
  type SessionOptionValue
} from '../../../src/shared/native-chat-session-options'
import {
  mobileModelPillLabel,
  mobileSelectedChoiceLabel,
  mobileSessionOptionDisabledReason,
  mobileSessionOptionNote,
  mobileSessionOptionSheetTitle,
  mobileSessionOptionSummaryValue
} from './mobile-native-chat-session-option-labels'
import {
  mobileAccessChoiceLabel,
  mobileAccessCurrentValue,
  mobileAccessDescriptorWithLabels,
  mobileAccessDisplay
} from './mobile-native-chat-access-mode-display'
import { mobileEffortDescriptorWithDescriptions } from './mobile-native-chat-effort-descriptions'
import { effortMeterLevel, effortMeterLevelForValue } from './mobile-native-chat-effort-meter'
import { isMobileFastModeOn } from './mobile-native-chat-fast-mode'
import { splitModelSheet } from './mobile-native-chat-featured-models'
import {
  DescriptorRows,
  SessionOptionCaption,
  SessionOptionSummaryRow
} from './MobileNativeChatSessionOptionRows'
import { MobileNativeChatModelPill } from './MobileNativeChatModelPill'
import { MobileNativeChatEffortButton } from './MobileNativeChatEffortButton'
import { MobileNativeChatEffortMeter } from './MobileNativeChatEffortMeter'
import { MobileNativeChatAccessButton } from './MobileNativeChatAccessButton'
import { MobileNativeChatAccessIcon } from './MobileNativeChatAccessIcon'
import { sortNativeChatSessionOptions } from '../../../src/shared/native-chat-session-option-snapshot'
import type { MobileNativeChatSessionOptionsController } from './use-mobile-native-chat-session-options'

export type MobileNativeChatSessionOptionPickersProps = {
  controller: MobileNativeChatSessionOptionsController
  /** Pickers lock while the agent works — a mid-turn `/model` interleaves with
   *  the agent's own output (desktop parity). */
  isWorking: boolean
  /** A composer send owns the TUI input line until it settles. The host spaces a
   *  send's body and its Enter ~500ms apart, so an apply dispatched inside that
   *  window would be submitted as part of the user's prompt. The composer blocks
   *  the reverse direction on `pendingId`; this is the same guard mirrored. */
  sendInFlight?: boolean
  /** The chat's agent id; its icon leads the model pill. Absent renders no icon. */
  agent?: string | null
  /** The chat's Pi runtime, so a Gentle Shell chat keeps its own icon. */
  piRuntime?: PiRowRuntime
}

const UNCONFIRMED_CAPTION = 'Sent to the agent — not confirmed'

// Why: a boolean option (fast mode) is one switch, so it sits in the model sheet instead of its own panel.
function isInlineSwitch(descriptor: SessionOptionDescriptor): boolean {
  return descriptor.kind.type === 'boolean' && descriptor.action === undefined
}

// Why: full access is the one access choice that must read as a risk before it is picked.
function accessChoiceLabelColor(value: string): string | undefined {
  return value === 'full-access' ? colors.statusRed : undefined
}

/** The glyph before each sheet row: the effort level's meter, or the access mode's icon. */
function choiceLeadingFor(
  descriptor: SessionOptionDescriptor
): ((choice: SessionOptionSelectChoice) => React.ReactNode) | undefined {
  if (descriptor.id === 'effort') {
    return (choice) => (
      <MobileNativeChatEffortMeter level={effortMeterLevelForValue(descriptor, choice.value)} />
    )
  }
  if (descriptor.id === 'accessMode') {
    return (choice) => (
      <MobileNativeChatAccessIcon
        display={mobileAccessDisplay(choice.value, descriptor.inheritedAccess)}
        size={20}
      />
    )
  }
  return undefined
}

/** Model pill, effort and access buttons, and the bottom sheet each one opens. */
export function MobileNativeChatSessionOptionPickers({
  controller,
  isWorking,
  sendInFlight = false,
  agent = null,
  piRuntime
}: MobileNativeChatSessionOptionPickersProps): React.JSX.Element | null {
  const [openDescriptorId, setOpenDescriptorId] = useState<string | null>(null)
  // A sheet opened from the model list returns there; the toolbar sheets close instead.
  const [returnsToModels, setReturnsToModels] = useState(false)
  // "More models" is a second view of the model sheet, not a sheet of its own.
  const [inMoreModels, setInMoreModels] = useState(false)
  const [lastRequest, setLastRequest] = useState(controller.optionPickerRequest)
  if (controller.optionPickerRequest && lastRequest !== controller.optionPickerRequest) {
    setLastRequest(controller.optionPickerRequest)
    setOpenDescriptorId(controller.optionPickerRequest.id)
    setReturnsToModels(true)
    setInMoreModels(false)
  }
  const { snapshot, pendingId } = controller
  const model = snapshot.find((descriptor) => descriptor.category === 'model')
  if (!model) {
    return null
  }
  const effort = snapshot.find((descriptor) => descriptor.id === 'effort')
  const access = snapshot.find((descriptor) => descriptor.id === 'accessMode')
  // Effort and access have their own buttons, so the model sheet lists only the rest.
  const summaryOptions = sortNativeChatSessionOptions(snapshot).filter(
    (descriptor) => descriptor.id !== 'effort' && descriptor.id !== 'accessMode'
  )
  const disabled = isWorking || pendingId !== null || sendInFlight
  const activeDescriptor = snapshot.find((descriptor) => descriptor.id === openDescriptorId)
  const modelView = activeDescriptor?.id === model.id
  const backToModels = activeDescriptor !== undefined && !modelView && returnsToModels
  // Featured models lead; the rest fold behind "More models" until that view is open.
  const modelSplit = splitModelSheet(model, agent)
  const moreModels = modelView && inMoreModels ? modelSplit.more : null
  const moreView = moreModels !== null
  const modelRows = moreModels ?? modelSplit.featured
  const navigatesBack = moreView || backToModels
  const accessSheet = activeDescriptor?.id === 'accessMode'
  const reason = mobileSessionOptionDisabledReason(activeDescriptor?.disabledReason)
  const modelLabel = mobileModelPillLabel(model)
  const fast = isMobileFastModeOn(snapshot)
  const effortLabel = (effort ? mobileSelectedChoiceLabel(effort) : null) ?? 'Effort'
  const accessValue = access ? mobileAccessCurrentValue(access) : 'inherit'
  const accessLabel = mobileAccessChoiceLabel(accessValue) ?? accessValue

  const closePicker = (): void => {
    setOpenDescriptorId(null)
    setInMoreModels(false)
  }
  const openModels = (): void => {
    Keyboard.dismiss()
    setReturnsToModels(false)
    setInMoreModels(false)
    setOpenDescriptorId(model.id)
  }
  const openMoreModels = (): void => setInMoreModels(true)
  const onSheetNav = (): void => {
    if (moreView) {
      setInMoreModels(false)
    } else if (backToModels) {
      openModels()
    } else {
      closePicker()
    }
  }
  const openToolbarSheet = (descriptor: SessionOptionDescriptor): void => {
    Keyboard.dismiss()
    setReturnsToModels(false)
    setOpenDescriptorId(descriptor.id)
  }
  const openSummaryOption = (descriptor: SessionOptionDescriptor): void => {
    setReturnsToModels(true)
    setOpenDescriptorId(descriptor.id)
  }

  // Re-picking the tracked value is a no-op — never re-dispatch it.
  const isTrackedValue = (
    descriptor: SessionOptionDescriptor,
    value: SessionOptionValue
  ): boolean =>
    descriptor.valueSource !== 'unknown' &&
    (descriptor.kind.type === 'select' || descriptor.kind.type === 'boolean') &&
    descriptor.kind.currentValue === value
  const applyOption = (descriptor: SessionOptionDescriptor, value: SessionOptionValue): void => {
    if (isTrackedValue(descriptor, value)) {
      closePicker()
      return
    }
    void controller.setOption(descriptor.id, value).then((applied) => {
      if (applied) {
        closePicker()
      }
    })
  }
  // A switch flips in place: the model sheet stays open while the value dispatches.
  const toggleInline = (descriptor: SessionOptionDescriptor, value: SessionOptionValue): void => {
    if (!isTrackedValue(descriptor, value)) {
      void controller.setOption(descriptor.id, value)
    }
  }
  const inlineSwitchRow = (
    descriptor: SessionOptionDescriptor,
    divided: boolean
  ): React.JSX.Element => {
    const reasonText = mobileSessionOptionDisabledReason(descriptor.disabledReason)
    return (
      <View key={descriptor.id} style={divided ? styles.dividedRow : null}>
        {sessionOptionDispatchUnconfirmed(descriptor) ? (
          <SessionOptionCaption>{UNCONFIRMED_CAPTION}</SessionOptionCaption>
        ) : null}
        {reasonText ? <SessionOptionCaption>{reasonText}</SessionOptionCaption> : null}
        <DescriptorRows
          descriptor={descriptor}
          disabled={disabled}
          grouped
          onSetOption={(value) => toggleInline(descriptor, value)}
          onInvokeAction={() => invokeAction(descriptor)}
        />
      </View>
    )
  }
  const invokeAction = (descriptor: SessionOptionDescriptor): void => {
    void controller.invokeAction(descriptor.id).then((invoked) => {
      if (invoked) {
        closePicker()
      }
    })
  }

  // Access and effort rows gain labels and descriptions; the model sheet shows its current list.
  const sheetRowsFor = (descriptor: SessionOptionDescriptor): SessionOptionDescriptor => {
    if (descriptor.id === 'accessMode') {
      return mobileAccessDescriptorWithLabels(descriptor)
    }
    if (descriptor.id === 'effort') {
      return mobileEffortDescriptorWithDescriptions(descriptor)
    }
    return descriptor.id === model.id ? modelRows : descriptor
  }

  return (
    <>
      <MobileNativeChatModelPill
        agent={agent}
        piRuntime={piRuntime}
        label={modelLabel}
        fast={fast}
        accessibleName={`Model, ${modelLabel}${fast ? ', fast mode' : ''}`}
        disabled={disabled}
        onPress={openModels}
      />
      {effort ? (
        <MobileNativeChatEffortButton
          accessibleName={`Effort, ${effortLabel}`}
          level={effortMeterLevel(effort)}
          disabled={disabled}
          onPress={() => openToolbarSheet(effort)}
        />
      ) : null}
      {access ? (
        <MobileNativeChatAccessButton
          accessibleName={`Access, ${accessLabel}`}
          display={mobileAccessDisplay(accessValue, access.inheritedAccess)}
          disabled={disabled}
          onPress={() => openToolbarSheet(access)}
        />
      ) : null}
      <BottomDrawer visible={activeDescriptor !== undefined} onClose={closePicker}>
        {activeDescriptor ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityLabel={navigatesBack ? 'Back to models' : 'Close picker'}
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetNav, pressed && styles.pressed]}
                onPress={onSheetNav}
                hitSlop={8}
              >
                {navigatesBack ? (
                  <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2.2} />
                ) : (
                  <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
                )}
              </Pressable>
              <Text style={styles.sheetTitle}>
                {modelView
                  ? moreView
                    ? 'More models'
                    : 'Select model'
                  : mobileSessionOptionSheetTitle(activeDescriptor)}
              </Text>
              <View style={styles.sheetHeaderSide}>
                {pendingId !== null ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : null}
              </View>
            </View>
            {sessionOptionDispatchUnconfirmed(activeDescriptor) ? (
              <SessionOptionCaption>{UNCONFIRMED_CAPTION}</SessionOptionCaption>
            ) : null}
            {activeDescriptor.note ? (
              <SessionOptionCaption>
                {mobileSessionOptionNote(activeDescriptor.note)}
              </SessionOptionCaption>
            ) : null}
            {reason ? <SessionOptionCaption>{reason}</SessionOptionCaption> : null}
            <View style={styles.choiceGroup}>
              <DescriptorRows
                descriptor={sheetRowsFor(activeDescriptor)}
                disabled={disabled}
                grouped
                choiceLabelColor={accessSheet ? accessChoiceLabelColor : undefined}
                choiceLeading={choiceLeadingFor(activeDescriptor)}
                onSetOption={(value) => applyOption(activeDescriptor, value)}
                onInvokeAction={() => invokeAction(activeDescriptor)}
              />
            </View>
            {modelView && !moreView && (modelSplit.moreCount > 0 || summaryOptions.length > 0) ? (
              <View style={styles.optionGroup}>
                {modelSplit.moreCount > 0 ? (
                  <SessionOptionSummaryRow
                    label="More models"
                    value={String(modelSplit.moreCount)}
                    disabled={disabled}
                    divided={summaryOptions.length > 0}
                    onPress={openMoreModels}
                  />
                ) : null}
                {summaryOptions.map((descriptor, index) =>
                  isInlineSwitch(descriptor) ? (
                    inlineSwitchRow(descriptor, index < summaryOptions.length - 1)
                  ) : (
                    <SessionOptionSummaryRow
                      key={descriptor.id}
                      label={descriptor.label}
                      value={mobileSessionOptionSummaryValue(descriptor)}
                      disabled={disabled}
                      divided={index < summaryOptions.length - 1}
                      onPress={() => openSummaryOption(descriptor)}
                    />
                  )
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </BottomDrawer>
    </>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: spacing.xs
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.lg
  },
  sheetTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '700',
    textAlign: 'center'
  },
  sheetNav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  sheetHeaderSide: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  choiceGroup: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  dividedRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  optionGroup: {
    overflow: 'hidden',
    marginTop: spacing.md,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  pressed: {
    opacity: 0.7
  }
})
