import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  CornerDownLeft,
  FileText,
  ImagePlus,
  Keyboard as KeyboardIcon,
  Monitor,
  Plus,
  Smartphone
} from 'lucide-react-native'
import { useKeyboardPersistingTaps } from '../platform/keyboard-persisting-taps'
import { hostOs } from '../platform/host-os'
import { getTerminalLiveInputKeyboardType } from '../terminal/terminal-keyboard-type'
import {
  isTerminalKeyChordBuilding,
  terminalKeyChordStatus
} from '../terminal/terminal-key-chord-state'
import { colors, spacing } from '../theme/mobile-theme'
import { MobileTerminalDictationButton } from './MobileTerminalInputActions'
import { MobileTerminalKeyRow } from './MobileTerminalKeyRow'
import { isTerminalPhoneDisplayMode } from './mobile-session-route-helpers'
import {
  resolveTerminalComposerLayout,
  resolveTerminalComposerOffset
} from './mobile-terminal-composer-layout'
import { terminalComposerStyles as styles } from './mobile-terminal-composer-styles'
import type { MobileSessionController } from './use-mobile-session-controller'
import { useTerminalKeyChord } from './use-terminal-key-chord'

/** The controller fields the live composer reads; dictation is narrowed to its three flags. */
export type MobileTerminalComposerController = Pick<
  MobileSessionController,
  | 'activeBrowserTab'
  | 'activeFileTab'
  | 'activeHandle'
  | 'activeMarkdownTab'
  | 'attachImage'
  | 'bindLiveInputField'
  | 'canPaste'
  | 'canSend'
  | 'cancelDictation'
  | 'customKeys'
  | 'dictationMode'
  | 'dismissSoftwareKeyboard'
  | 'focusLiveInput'
  | 'handleAccessoryKey'
  | 'handleDictationPressIn'
  | 'handleDictationPressOut'
  | 'handleDictationToggle'
  | 'handleLiveInputChange'
  | 'handleLiveInputKeyPress'
  | 'handlePaste'
  | 'insets'
  | 'isAttaching'
  | 'keyboardLift'
  | 'liveInputCapture'
  | 'setDeleteKeyTarget'
  | 'setShowCustomKeyModal'
  | 'showNativeChat'
  | 'submitLiveInput'
  | 'terminalKeyboardFit'
  | 'terminalModes'
  | 'toggleDisplayMode'
> & {
  readonly dictation: Pick<
    MobileSessionController['dictation'],
    'isProcessing' | 'isRecording' | 'isStarting'
  >
}

// Why: Enter is a carriage return; the shell runs the line it completes.
const ENTER_INPUT = { bytes: '\r' }

/**
 * The Terminal panel's composer. Every key goes straight to the shell: there is no buffered box
 * and no Command | Live switch. The Keys row builds chords, and the card holds attach, the width
 * toggle, the tap area, the mic and Enter.
 */
export function MobileTerminalComposerDock({
  controller
}: {
  controller: MobileTerminalComposerController
}) {
  const {
    activeBrowserTab,
    activeFileTab,
    activeHandle,
    activeMarkdownTab,
    attachImage,
    bindLiveInputField,
    canPaste,
    canSend,
    cancelDictation,
    customKeys,
    dictation,
    dictationMode,
    dismissSoftwareKeyboard,
    focusLiveInput,
    handleAccessoryKey,
    handleDictationPressIn,
    handleDictationPressOut,
    handleDictationToggle,
    handleLiveInputChange,
    handleLiveInputKeyPress,
    handlePaste,
    insets,
    isAttaching,
    keyboardLift,
    liveInputCapture,
    setDeleteKeyTarget,
    setShowCustomKeyModal,
    showNativeChat,
    submitLiveInput,
    terminalKeyboardFit,
    terminalModes,
    toggleDisplayMode
  } = controller
  const [keysOpen, setKeysOpen] = useState(true)
  const [attachOpen, setAttachOpen] = useState(false)
  const keyChord = useTerminalKeyChord(activeHandle)
  const keepKeyboard = useKeyboardPersistingTaps('always')
  // The soft keyboard is up when the controller reports a lift; the composer sits above it.
  const keyboardUp = keyboardLift > 0
  const offset = resolveTerminalComposerOffset(terminalKeyboardFit, keyboardLift)
  const layout = resolveTerminalComposerLayout({
    keyboardUp,
    keysOpen,
    chordBuilding: isTerminalKeyChordBuilding(keyChord.chord),
    chordSentShowing: keyChord.sentLabel !== null
  })
  if (activeMarkdownTab || activeFileTab || activeBrowserTab || showNativeChat) {
    return null
  }
  const phoneMode = isTerminalPhoneDisplayMode(activeHandle, terminalModes)
  const sendChord = () => {
    const bytes = keyChord.send()
    if (bytes !== null) {
      void handleAccessoryKey({ bytes })
    }
  }

  return (
    <View
      ref={keepKeyboard}
      style={[
        styles.dock,
        {
          paddingBottom: insets.bottom + spacing.sm,
          marginBottom: offset.marginBottom,
          transform: [{ translateY: offset.translateY }]
        }
      ]}
    >
      {layout.showKeysToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keys"
          accessibilityState={{ expanded: keysOpen }}
          onPress={() => setKeysOpen(!keysOpen)}
          style={({ pressed }) => [styles.keysToggle, pressed && styles.pressed]}
        >
          <KeyboardIcon size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.keysToggleText}>Keys</Text>
          {keysOpen ? (
            <ChevronUp size={12} color={colors.textSecondary} strokeWidth={2.4} />
          ) : (
            <ChevronDown size={12} color={colors.textSecondary} strokeWidth={2.4} />
          )}
        </Pressable>
      ) : null}
      {layout.showKeyRow ? (
        <MobileTerminalKeyRow
          chord={keyChord.chord}
          status={terminalKeyChordStatus(keyChord.chord)}
          sentLabel={keyChord.sentLabel}
          showChordBar={layout.showChordBar}
          customKeys={customKeys}
          disabled={!canSend}
          onToggleModifier={keyChord.toggleModifier}
          onSelectKey={keyChord.selectMainKey}
          onClear={keyChord.clear}
          onSend={sendChord}
          onAddShortcut={() => setShowCustomKeyModal(true)}
          onDeleteShortcut={(key) => setDeleteKeyTarget(key)}
        />
      ) : null}

      <View style={styles.cardWrap}>
        {attachOpen && canSend ? (
          <View style={styles.menu}>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityLabel="Attach a photo"
              onPress={() => {
                setAttachOpen(false)
                void attachImage('library')
              }}
              style={styles.menuItem}
            >
              <ImagePlus size={16} color={colors.textPrimary} strokeWidth={2} />
              <Text style={styles.menuItemText}>Photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityLabel="Attach a file"
              onPress={() => {
                setAttachOpen(false)
                void attachImage('files')
              }}
              style={styles.menuItem}
            >
              <FileText size={16} color={colors.textPrimary} strokeWidth={2} />
              <Text style={styles.menuItemText}>File</Text>
            </Pressable>
            {canPaste ? (
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel="Paste from clipboard"
                onPress={() => {
                  setAttachOpen(false)
                  void handlePaste()
                }}
                style={styles.menuItem}
              >
                <ClipboardPaste size={16} color={colors.textPrimary} strokeWidth={2} />
                <Text style={styles.menuItemText}>Paste clipboard</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.card, keyboardUp && styles.cardActive]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach or paste"
            accessibilityState={{ expanded: attachOpen }}
            disabled={!canSend || isAttaching}
            onPress={() => setAttachOpen(!attachOpen)}
            style={({ pressed }) => [
              styles.roundButton,
              (!canSend || isAttaching) && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            {isAttaching ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Plus size={17} color={colors.textPrimary} strokeWidth={2.2} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={phoneMode ? 'Switch to desktop mode' : 'Switch to phone mode'}
            disabled={!canSend || activeHandle === null}
            onPress={() => {
              if (activeHandle) {
                void toggleDisplayMode(activeHandle)
              }
            }}
            style={({ pressed }) => [
              styles.widthButton,
              (!canSend || activeHandle === null) && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            {phoneMode ? (
              <Smartphone size={14} color={colors.textSecondary} strokeWidth={2} />
            ) : (
              <Monitor size={14} color={colors.textSecondary} strokeWidth={2} />
            )}
            <Text style={styles.widthButtonText}>{phoneMode ? 'Phone' : 'Desktop'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show keyboard for terminal input"
            accessibilityHint="Typed text is sent directly to the active terminal"
            disabled={!canSend}
            onPress={focusLiveInput}
            style={styles.tapArea}
          />
          {keyboardUp ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
              accessibilityHint="Hides the software keyboard and keeps the current terminal session open."
              hitSlop={8}
              onPress={dismissSoftwareKeyboard}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <KeyboardIcon size={16} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          ) : null}
          <MobileTerminalDictationButton
            canSend={canSend}
            dictation={dictation}
            dictationMode={dictationMode}
            buttonStyle={styles.roundButton}
            activeButtonStyle={styles.roundButtonActive}
            disabledButtonStyle={styles.disabled}
            onToggle={handleDictationToggle}
            onPressIn={handleDictationPressIn}
            onPressOut={handleDictationPressOut}
            onCancel={cancelDictation}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter"
            disabled={!canSend}
            onPress={() => void handleAccessoryKey(ENTER_INPUT)}
            style={({ pressed }) => [
              styles.enterButton,
              !canSend && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <CornerDownLeft size={18} color={colors.bgBase} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <TextInput
        ref={bindLiveInputField}
        style={styles.liveInputCapture}
        value={liveInputCapture}
        onChange={handleLiveInputChange}
        onKeyPress={handleLiveInputKeyPress}
        onSubmitEditing={submitLiveInput}
        placeholder=""
        showSoftInputOnFocus
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        smartInsertDelete={false}
        // Why: iOS textContentType overrides autoComplete and can narrow the keyboard; keep IME switching available.
        autoComplete="off"
        keyboardType={getTerminalLiveInputKeyboardType(hostOs())}
        returnKeyType="default"
        blurOnSubmit={false}
        editable={canSend}
        importantForAutofill="no"
      />
    </View>
  )
}
