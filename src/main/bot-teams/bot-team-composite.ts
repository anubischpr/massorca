type NamedBot = { id: string; name: string; job: string }

/**
 * What the owner of a composite task reads when it starts: take your part, and hand the other parts
 * to the bots whose descriptions cover them, through the command that already files a child session.
 */
export function botTeamCompositeNotes(
  bots: readonly NamedBot[],
  alsoNeedsBotIds: readonly string[]
): string | null {
  const others = alsoNeedsBotIds.flatMap((id) => bots.filter((bot) => bot.id === id))
  if (others.length === 0) {
    return null
  }
  const roster = others.map((bot) => (bot.job ? `${bot.name} (${bot.job})` : bot.name)).join(', ')
  return [
    `This is a composite task: it has parts for other bots on your team. Do the part that fits your job, and coordinate the rest with ${roster}.`,
    'For each other part, run `orca orchestration team-delegate --bot <name> --text "<that part, with what they need from you>"`, then post in the Conference room what you handed to whom, and bring the parts together when they are done.'
  ].join(' ')
}
