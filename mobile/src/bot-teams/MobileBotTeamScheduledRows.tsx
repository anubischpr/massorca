import { Text, View } from 'react-native'
import type { HostWallTime } from '../../../src/shared/bot-team-routine-schedule'
import type { BotTeamRoutine } from '../../../src/shared/rpc-contract/bot-team-routine-params'
import { mobileRoutineWhenLabel, mobileViewerWall } from './MobileBotTeamRoutineLabels'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

type ScheduledOnceRow = { id: string; name: string; when: HostWallTime }

/** One-time routines still to run, soonest on the viewer's clock: not paused, and their moment has not passed. */
export function scheduledOnceRows(routines: readonly BotTeamRoutine[]): ScheduledOnceRow[] {
  return routines
    .flatMap((routine) =>
      routine.schedule.frequency === 'once' && !routine.paused && routine.nextRun !== null
        ? [
            {
              id: routine.id,
              name: routine.name,
              when: mobileViewerWall(routine.nextRun, routine.nextRunAt)
            }
          ]
        : []
    )
    .sort((a, b) => `${a.when.date} ${a.when.time}`.localeCompare(`${b.when.date} ${b.when.time}`))
}

/** A board's one-time routines as small rows: the name, and when the routine runs next. */
export function MobileBotTeamScheduledRows({ routines }: { routines: readonly BotTeamRoutine[] }) {
  return (
    <>
      {scheduledOnceRows(routines).map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {row.name}
            </Text>
            <Text style={styles.rowMeta}>{`Scheduled · ${mobileRoutineWhenLabel(row.when)}`}</Text>
          </View>
        </View>
      ))}
    </>
  )
}
