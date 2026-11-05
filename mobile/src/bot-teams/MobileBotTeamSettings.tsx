import { ScrollView, Switch, Text, View } from 'react-native'
import { colors } from '../theme/mobile-theme'
import { MobileBotTeamWorkBar as SubBar } from './MobileBotTeamWorkBar'
import {
  setBotCharacterAnimations,
  useBotCharacterAnimations
} from './mobile-bot-character-preference'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** Bot teams settings: the character animations. Each team's access sits in its Edit team screen. */
export function MobileBotTeamSettings({ onBack }: { onBack: () => void }) {
  const characterAnimations = useBotCharacterAnimations()
  return (
    <>
      <SubBar title="Bot teams" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Character animations</Text>
            <Text style={styles.rowMeta}>
              Team characters move and react. Off, a still glow shows who is working.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Character animations"
            value={characterAnimations}
            onValueChange={setBotCharacterAnimations}
            trackColor={{ true: colors.textSecondary }}
          />
        </View>
      </ScrollView>
    </>
  )
}
