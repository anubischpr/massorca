import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../theme/mobile-theme'
import { PROTOTYPE_UNREADABLE_LINE } from './MobilePrototypeFrame'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'

/** A viewer opened without the host or the prototype it names: the unreadable line, and a way back. */
export function MobilePrototypeUnopenable({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader title="" onBack={onBack} />
      <View style={styles.area}>
        <View style={styles.box}>
          <Text style={styles.error}>{PROTOTYPE_UNREADABLE_LINE}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  area: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.editorSurface
  },
  box: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: colors.surfaceBright
  },
  error: {
    padding: 24,
    color: colors.bgBase,
    fontSize: 14
  }
})
