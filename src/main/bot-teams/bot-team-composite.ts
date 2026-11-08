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
    'For each other part, run `orca orchestration team-delegate --bot <name> --text "<that part, with what they need from you>"`. If that command fails, the part did not start: do it yourself, or tell the room in the first person that you could not start it; never say it was handed over, and do not finish while a part has not started. The same goes for `orca orchestration delegate` when it files a child session for a part: if it fails, the part did not start.',
    'Run waits and other independent parts at the same time, not blocking. In the final room post, list the outcome of each part, including any background wait.',
    'In the Conference room speak only for your own part, in the first person, in the language of the request, and never with a line that only says you took or will do something. Never mention the hand-offs there: each teammate posts for its own part when it finishes. When every part is done, post your own deliverable once, by file name, never a path; never re-list or re-attach files a teammate made.'
  ].join(' ')
}
