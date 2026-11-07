import { plainWords } from '../../shared/bot-team-request-action'
import type { BotTeamRoutine } from '../../shared/rpc-contract/bot-team-routine-params'
import { listBotTeamRoutines } from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

// Words about when a request runs, not about its work: a day, a time, a filler. They never make two requests alike.
const WHEN_WORDS = new Set([
  'manana',
  'hoy',
  'pasado',
  'proxima',
  'proximo',
  'siguiente',
  'semana',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
  'tomorrow',
  'today',
  'week',
  'next',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'cada',
  'every',
  'para',
  'favor',
  'please',
  'programa',
  'programe',
  'programen',
  'schedule',
  'scheduled',
  'agenda',
  'agendar',
  'tarea',
  'task',
  'that',
  'this',
  'with',
  'from',
  'about'
])

/** The words of a title that say what the work is: at least four letters, and not about when it runs. */
function workWords(title: string): Set<string> {
  return new Set(
    plainWords(title).filter(
      (word) => word.length >= 4 && !/^\d+$/.test(word) && !WHEN_WORDS.has(word)
    )
  )
}

/**
 * How alike two titles are: the work words they share over all their work words, from 0 to 1. "Revisa el
 * front" and "Revisa el front de la web" share every word; "Revisión del backend" shares none with them.
 */
function titleSimilarity(a: string, b: string): number {
  const left = workWords(a)
  const right = workWords(b)
  const all = new Set([...left, ...right])
  if (all.size === 0) {
    return 0
  }
  const shared = [...left].filter((word) => right.has(word)).length
  return shared / all.size
}

const SIMILAR_AT_LEAST = 0.5

/**
 * The team's one-time routine that a new one-time request is like, when the team still has it to run, of
 * any bot: the room may route two alike requests to different bots. A routine counts only while it will run
 * again: a paused, recurring or passed one is never offered, because moving it would drop its repeats or
 * revive a run that is over.
 */
export function findSimilarBotTeamRoutine(
  db: OrchestrationDb,
  args: { teamId: string; title: string }
): BotTeamRoutine | null {
  let best: BotTeamRoutine | null = null
  let bestScore = 0
  for (const routine of listBotTeamRoutines(db, args.teamId)) {
    if (routine.schedule.frequency !== 'once' || routine.paused || routine.nextRun === null) {
      continue
    }
    const score = titleSimilarity(args.title, routine.name)
    if (score >= SIMILAR_AT_LEAST && score > bestScore) {
      best = routine
      bestScore = score
    }
  }
  return best
}
