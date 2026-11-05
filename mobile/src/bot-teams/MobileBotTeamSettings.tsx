import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { MobileBotTeamWorkBar as SubBar } from './MobileBotTeamWorkBar'
import {
  setBotCharacterAnimations,
  useBotCharacterAnimations
} from './mobile-bot-character-preference'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** Bot teams settings: the character animations, then each team's access and its Marketplace apps. */
export function MobileBotTeamSettings({
  teams,
  onBack,
  onToggleAccess,
  onOpenMarketplace
}: {
  teams: readonly BotTeam[]
  onBack: () => void
  onToggleAccess: (team: BotTeam) => void
  onOpenMarketplace: (team: BotTeam) => void
}) {
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
        <Text style={styles.rowMeta}>
          What each team can do without asking. New teams start with full access.
        </Text>
        {teams.map((team) => (
          <View key={team.id} style={{ gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${team.name} access`}
              onPress={() => onToggleAccess(team)}
              style={styles.row}
            >
              <MobileBotTeamCharacterIcon character={team.character} size={28} still />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{team.name}</Text>
                <Text style={styles.rowMeta}>
                  {team.accessMode === 'full-access' ? 'Full access' : 'Ask first'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${team.name} Marketplace apps`}
              onPress={() => onOpenMarketplace(team)}
              style={[styles.row, { marginLeft: spacing.xl }]}
            >
              <Text style={[styles.rowTitle, styles.grow]}>Marketplace apps</Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </>
  )
}
