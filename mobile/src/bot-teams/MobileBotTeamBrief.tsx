import { ScrollView, Text, View } from 'react-native'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The brief the bots read, as the board draws it. The phone only reads it; the desktop edits it. */
export function MobileBotTeamBrief({ project }: { project: BotTeamProject }) {
  const { brief } = project
  return (
    <ScrollView contentContainerStyle={styles.form}>
      <Text style={styles.rowMeta}>
        The project holds the why. Each task holds the how. Bots read this brief and their own task
        thread.
      </Text>
      <Text style={styles.label}>Goal</Text>
      <Text style={styles.rowTitle}>{project.goal}</Text>
      <Text style={styles.label}>Requirements</Text>
      {brief.requirements.length === 0 ? (
        <Text style={styles.rowMeta}>No requirements yet.</Text>
      ) : null}
      {brief.requirements.map((requirement, index) => (
        <View key={`${index}:${requirement}`} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{requirement}</Text>
            <Text style={styles.rowMeta}>Not linked yet</Text>
          </View>
        </View>
      ))}
      <Text style={styles.label}>Constraints</Text>
      {brief.constraints.map((constraint, index) => (
        <View key={`${index}:${constraint}`} style={styles.row}>
          <Text style={styles.rowTitle}>{constraint}</Text>
        </View>
      ))}
      <Text style={styles.label}>Decisions</Text>
      {brief.decisions.map((decision, index) => (
        <View key={`${index}:${decision}`} style={styles.row}>
          <Text style={styles.rowTitle}>{decision}</Text>
        </View>
      ))}
      {project.briefUpdatedAt === null ? null : (
        <Text style={styles.rowMeta}>
          {`Updated ${new Date(project.briefUpdatedAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })} by you.`}
        </Text>
      )}
    </ScrollView>
  )
}
