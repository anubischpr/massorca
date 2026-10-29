import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  DEFAULT_PROTOTYPE_COUNT_SETTING,
  clampPrototypeCount,
  type PrototypeCountSetting
} from '../../../src/shared/prototype-count-setting'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import {
  readMobilePrototypeCountSetting,
  writeMobilePrototypeCountSetting
} from './mobile-prototype-count-setting'
import { mobilePrototypePromptLine } from './mobile-prototype-prompt-line'

/** Settings › Prototypes: how many directions a prototype request asks for. */
export function MobilePrototypeSettingsScreen({ hostId }: { hostId: string }) {
  const router = useRouter()
  const { client } = useHostClient(hostId)
  const [setting, setSetting] = useState<PrototypeCountSetting>(DEFAULT_PROTOTYPE_COUNT_SETTING)
  useEffect(() => {
    if (client === null) {
      return
    }
    let active = true
    void readMobilePrototypeCountSetting(client).then((read) => {
      if (active) {
        setSetting(read)
      }
    })
    return () => {
      active = false
    }
  }, [client])
  const save = useCallback(
    (next: PrototypeCountSetting) => {
      setSetting(next)
      if (client !== null) {
        void writeMobilePrototypeCountSetting(client, next)
      }
    },
    [client]
  )
  const always = setting.mode === 'always'
  const step = (delta: number): void =>
    save({ ...setting, count: clampPrototypeCount(setting.count + delta) })
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader title="Prototypes" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Alternatives per request</Text>
        <View style={styles.group}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: always }}
            accessibilityLabel="Always make"
            onPress={() => save({ ...setting, mode: 'always' })}
            style={[styles.row, styles.rowDivider]}
          >
            <Radio selected={always} />
            <Text style={styles.rowLabel}>Always make</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fewer"
                onPress={() => step(-1)}
                style={styles.stepButton}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.count}>{setting.count}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More"
                onPress={() => step(1)}
                style={styles.stepButton}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: !always }}
            accessibilityLabel="Ask each time"
            onPress={() => save({ ...setting, mode: 'ask' })}
            style={styles.row}
          >
            <Radio selected={!always} />
            <View style={styles.rowLabelBlock}>
              <Text style={styles.rowLabelPlain}>Ask each time</Text>
              <Text style={styles.rowHint}>A 1 / 2 / 3 card appears in the chat</Text>
            </View>
          </Pressable>
        </View>
        <Text style={styles.sectionLabel}>Added to your prompt</Text>
        <View style={styles.promptBox}>
          <Text style={styles.promptText}>{mobilePrototypePromptLine(setting)}</Text>
        </View>
        <Text style={styles.footer}>
          Same text for every agent. Results are grouped as one set per request. Default: always 2.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, gap: spacing.lg },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.65,
    textTransform: 'uppercase'
  },
  group: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  rowLabel: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  rowLabelBlock: { flex: 1 },
  rowLabelPlain: { color: colors.textPrimary, fontSize: 15 },
  rowHint: { color: colors.textSecondary, fontSize: 13 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioSelected: { borderColor: colors.accentBlue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentBlue },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  stepText: { color: colors.textPrimary, fontSize: 18 },
  count: {
    minWidth: 20,
    textAlign: 'center',
    color: colors.textPrimary,
    fontWeight: '600'
  },
  promptBox: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    backgroundColor: colors.bgPanel,
    padding: spacing.md
  },
  promptText: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: 12,
    lineHeight: 19
  },
  footer: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }
})
