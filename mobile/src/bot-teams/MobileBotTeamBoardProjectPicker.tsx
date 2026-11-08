import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check, ChevronDown } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors } from '../theme/mobile-theme'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

export type BoardProjectOption = {
  /** A project filter id from mobile-bot-team-board-filter.ts. */
  id: string
  name: string
  /** Tasks this option shows in the current status view. */
  count: number
}

/** The board's project selector: a row showing the chosen project, opening the list of every project. */
export function MobileBotTeamBoardProjectPicker({
  options,
  value,
  onChange
}: {
  options: readonly BoardProjectOption[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.id === value) ?? options[0]
  const choose = (id: string) => {
    onChange(id)
    setOpen(false)
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Project"
        onPress={() => setOpen(true)}
        style={styles.row}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowMeta}>Project</Text>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {current?.name}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>
      <BottomDrawer visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>Project</Text>
        {options.map((option) => {
          const selected = option.id === current?.id
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={option.name}
              accessibilityState={{ selected }}
              onPress={() => choose(option.id)}
              style={styles.row}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {option.name}
                </Text>
              </View>
              <Text style={styles.rowMeta}>{`${option.count}`}</Text>
              {selected ? <Check size={16} color={colors.textPrimary} /> : null}
            </Pressable>
          )
        })}
      </BottomDrawer>
    </>
  )
}
