import { lazy, Suspense } from 'react'
import { ScrollView, Text } from 'react-native'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamBrief } from './MobileBotTeamBrief'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

// Why: the Markdown renderer reads react-native members that some screen tests do not mock, so it loads only when a Markdown brief is drawn.
const MobileMarkdown = lazy(() =>
  import('../components/MobileMarkdown').then((module) => ({ default: module.MobileMarkdown }))
)

/** The Brief the bots read, drawn with its Markdown structure when one is saved. Read only. */
export function MobileBotTeamProjectBrief({ project }: { project: BotTeamProject }) {
  const { markdown } = project.brief
  if (typeof markdown !== 'string') {
    return <MobileBotTeamBrief project={project} />
  }
  return (
    <ScrollView contentContainerStyle={styles.form}>
      <Text style={styles.rowMeta}>
        The project holds the why. Each task holds the how. Bots read this brief and their own task
        thread.
      </Text>
      <Text style={styles.label}>Goal</Text>
      <Text style={styles.rowTitle}>{project.goal}</Text>
      <Text style={styles.label}>Brief</Text>
      <Suspense fallback={null}>
        <MobileMarkdown content={markdown} />
      </Suspense>
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
