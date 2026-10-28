import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check, ChevronRight } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { MobileSearchField } from '../components/MobileSearchField'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { CreateSessionChoice } from './create-session-model'

export type CreateSessionSheetRow = CreateSessionChoice & {
  /** Opens a deeper view instead of picking, so it shows a chevron rather than a check. */
  chevron?: boolean
}

export function CreateSessionChoiceSheet({
  visible,
  title,
  hint,
  rows,
  selectedValue,
  searchField,
  searchable = false,
  emptyMessage = 'Nothing to choose here yet.',
  onSelect,
  onClose
}: {
  visible: boolean
  title: string
  hint?: string
  rows: readonly CreateSessionSheetRow[]
  selectedValue?: string | null
  /** A search box shown above the rows, for lists too long to scan. */
  searchField?: React.ReactNode
  /** Filters the rows by label as the user types, for lists the host does not search itself. */
  searchable?: boolean
  emptyMessage?: string
  onSelect: (value: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLowerCase()
  const shown =
    searchable && needle ? rows.filter((row) => row.label.toLowerCase().includes(needle)) : rows
  const leave = (): void => {
    setFilter('')
    onClose()
  }
  return (
    <BottomDrawer visible={visible} onClose={leave}>
      <View style={styles.sheet}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {searchField}
        {searchable ? (
          <MobileSearchField
            value={filter}
            onChangeText={setFilter}
            placeholder="Search"
            accessibilityLabel={`Search ${title.toLowerCase()}`}
          />
        ) : null}
        <ScrollView style={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled">
          <View style={styles.group}>
            {shown.length === 0 ? (
              <Text style={styles.empty}>
                {needle ? `Nothing matches "${filter.trim()}".` : emptyMessage}
              </Text>
            ) : null}
            {shown.map((row, index) => {
              const selected = row.value === selectedValue
              return (
                <Pressable
                  key={row.value}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  accessibilityState={{ disabled: row.disabled === true, selected }}
                  disabled={row.disabled}
                  onPress={() => {
                    setFilter('')
                    onSelect(row.value)
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    index < shown.length - 1 && styles.rowDivider,
                    row.disabled && styles.rowDisabled,
                    pressed && styles.rowPressed
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {row.label}
                    </Text>
                    {row.description ? (
                      <Text style={styles.rowDescription} numberOfLines={2}>
                        {row.description}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Check size={18} color={colors.accentBlue} />
                  ) : row.chevron ? (
                    <ChevronRight size={16} color={colors.textMuted} />
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </View>
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  sheet: { paddingBottom: spacing.xs },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '700',
    textAlign: 'center',
    paddingBottom: spacing.sm
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    textAlign: 'center',
    paddingBottom: spacing.md
  },
  scroll: { maxHeight: 420 },
  group: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  empty: {
    color: colors.textSecondary,
    fontSize: typography.bodySize,
    padding: spacing.lg,
    textAlign: 'center'
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  rowDisabled: { opacity: 0.45 },
  rowPressed: { opacity: 0.7 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '500' },
  rowDescription: { color: colors.textSecondary, fontSize: typography.metaSize }
})
