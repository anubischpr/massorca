import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check } from 'lucide-react-native'
import {
  ROUTINE_QUICK_TIMES,
  isRoutineQuickTime,
  routineTimeOptions,
  type RoutineQuickTimeKey
} from '../../../src/shared/bot-team-routine-time-choices'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors, spacing } from '../theme/mobile-theme'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

const QUICK_NAMES: Record<RoutineQuickTimeKey, string> = {
  morning: 'Morning',
  noon: 'Noon',
  afternoon: 'Afternoon',
  evening: 'Evening'
}

/** Every time in the list is this tall, so the list can be measured without drawing it. */
const TIME_ROW_HEIGHT = 48

const pickerStyles = StyleSheet.create({
  dashed: { borderStyle: 'dashed' },
  sheet: { flex: 1, gap: spacing.sm, padding: spacing.lg },
  list: { flex: 1 },
  timeRow: {
    height: TIME_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md
  }
})

/** A routine's time: four quick times, and Other time for a quarter hour or a typed time. */
export function MobileBotTeamRoutineTimePicker({
  value,
  onChange
}: {
  value: string
  onChange: (time: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const other = !isRoutineQuickTime(value)
  const options = routineTimeOptions(typed)
  const close = () => {
    setOpen(false)
    setTyped('')
  }
  const choose = (time: string) => {
    onChange(time)
    close()
  }
  return (
    <>
      <View style={styles.chips}>
        {ROUTINE_QUICK_TIMES.map((entry) => (
          <Pressable
            key={entry.key}
            accessibilityRole="button"
            accessibilityState={{ selected: entry.time === value }}
            onPress={() => onChange(entry.time)}
            style={[styles.chip, entry.time === value && styles.rowSelected]}
          >
            <Text style={styles.rowTitle}>{`${QUICK_NAMES[entry.key]} ${entry.time}`}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: other }}
          onPress={() => setOpen(true)}
          style={[styles.chip, pickerStyles.dashed, other && styles.rowSelected]}
        >
          <Text style={styles.rowTitle}>{other ? value : 'Other time'}</Text>
        </Pressable>
      </View>
      <BottomDrawer
        visible={open}
        onClose={close}
        dragContentToDismiss={false}
        contentScrollable={false}
        fillAvailable
      >
        <View style={pickerStyles.sheet}>
          <Text style={styles.sheetTitle}>Other time</Text>
          <TextInput
            accessibilityLabel="Type a time"
            value={typed}
            onChangeText={setTyped}
            placeholder="Type a time"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {options.length === 0 ? <Text style={styles.message}>Not a time. Try 10:30.</Text> : null}
          <FlatList
            data={options}
            keyExtractor={(time) => time}
            getItemLayout={(_, index) => ({
              length: TIME_ROW_HEIGHT,
              offset: TIME_ROW_HEIGHT * index,
              index
            })}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={pickerStyles.list}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item === value }}
                onPress={() => choose(item)}
                style={pickerStyles.timeRow}
              >
                <Text style={styles.rowTitle}>{item}</Text>
                {item === value ? <Check size={16} color={colors.textPrimary} /> : null}
              </Pressable>
            )}
          />
          <Pressable accessibilityRole="button" onPress={close} style={styles.secondary}>
            <Text style={styles.rowTitle}>Cancel</Text>
          </Pressable>
        </View>
      </BottomDrawer>
    </>
  )
}
