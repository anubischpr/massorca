import { Pressable, StyleSheet, View } from 'react-native'
import { ArrowUp } from 'lucide-react-native'
import { MobileNativeChatSessionOptionPickers } from '../session/MobileNativeChatSessionOptionPickers'
import { colors, spacing } from '../theme/mobile-theme'
import type { CreateSessionOptions } from './use-create-session-options'

const SEND_SIZE = 40

/**
 * The composer row of the chat, before the chat exists: the same model pill, effort and access
 * buttons and sheets, then the button that creates the session. An agent with no pickers still
 * gets the button.
 */
export function CreateSessionComposerRow({
  agent,
  options,
  canSubmit,
  onSubmit
}: {
  agent: string | null
  options: CreateSessionOptions
  canSubmit: boolean
  onSubmit: () => void
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <MobileNativeChatSessionOptionPickers
        controller={options.controller}
        isWorking={false}
        agent={agent}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create session"
        accessibilityState={{ disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.send,
          canSubmit ? styles.sendReady : styles.sendIdle,
          pressed && canSubmit && styles.pressed
        ]}
      >
        <ArrowUp size={18} color={canSubmit ? colors.bgBase : colors.textMuted} strokeWidth={2.4} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingLeft: spacing.sm,
    paddingRight: 6,
    borderRadius: 22,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  send: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendReady: { backgroundColor: colors.textPrimary },
  sendIdle: { backgroundColor: colors.bgRaised },
  pressed: { opacity: 0.8 }
})
