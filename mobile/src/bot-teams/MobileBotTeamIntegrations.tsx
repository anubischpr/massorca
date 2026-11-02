import { Pressable, ScrollView, Text, View } from 'react-native'
import { Calendar, FolderOpen, Mail, Users, type LucideIcon } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

// The names are the board's placeholders for the apps to come; none of them connects yet.
const APPS: readonly { id: string; name: string; icon: LucideIcon }[] = [
  { id: 'email', name: 'Email', icon: Mail },
  { id: 'calendar', name: 'Calendar', icon: Calendar },
  { id: 'shared-drive', name: 'Shared drive', icon: FolderOpen },
  { id: 'crm', name: 'CRM', icon: Users }
]

/** The apps a team could be given. Nothing connects yet, so every Connect is off. */
export function MobileBotTeamIntegrations({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title="Integrations" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.rowMeta}>
          Connecting an app does not let bots act on their own. Permissions still apply.
        </Text>
        {APPS.map(({ id, name, icon: Icon }) => (
          <View key={id} style={styles.row}>
            <Icon size={20} color={colors.textSecondary} />
            <Text style={[styles.rowTitle, styles.grow]}>{name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Connect ${name}`}
              accessibilityState={{ disabled: true }}
              disabled
              style={[styles.secondary, styles.disabledAction]}
            >
              <Text style={styles.rowTitle}>Connect</Text>
            </Pressable>
          </View>
        ))}
        <Text style={styles.rowMeta}>Connecting apps is not available yet.</Text>
      </ScrollView>
    </View>
  )
}
