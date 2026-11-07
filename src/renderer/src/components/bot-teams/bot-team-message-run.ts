import type { BotTeamMessage } from '../../../../shared/rpc-contract/bot-team-room-params'

/** A pause longer than this starts a new run, so the next message shows its author again. */
export const BOT_TEAM_RUN_GAP_MS = 5 * 60_000

/** Whether `current` continues the run `previous` is in: the same author, and no long pause between them. */
export function botTeamMessageContinuesRun(
  previous: BotTeamMessage,
  current: BotTeamMessage,
  gapMs: number = BOT_TEAM_RUN_GAP_MS
): boolean {
  if (
    previous.authorBotId !== current.authorBotId ||
    (previous.fromTeamId ?? null) !== (current.fromTeamId ?? null)
  ) {
    return false
  }
  if (typeof previous.createdAt !== 'number' || typeof current.createdAt !== 'number') {
    return false
  }
  return current.createdAt - previous.createdAt <= gapMs
}

/** Splits the room's messages into runs; a message for which `endsRunAfter` holds closes its run. */
export function botTeamMessageRuns(
  messages: readonly BotTeamMessage[],
  endsRunAfter: (message: BotTeamMessage) => boolean = () => false
): BotTeamMessage[][] {
  const runs: BotTeamMessage[][] = []
  for (const message of messages) {
    const run = runs.at(-1)
    const previous = run?.at(-1)
    if (
      run &&
      previous &&
      !endsRunAfter(previous) &&
      botTeamMessageContinuesRun(previous, message)
    ) {
      run.push(message)
    } else {
      runs.push([message])
    }
  }
  return runs
}
