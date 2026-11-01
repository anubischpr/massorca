type NamedBot = { id: string; name: string }

/** The bot named as `@Name` in a request; a mentioned bot leads without any query. */
export function findMentionedBot<TBot extends NamedBot>(
  text: string,
  bots: readonly TBot[]
): TBot | null {
  const lower = text.toLowerCase()
  return (
    bots.find((bot) => {
      const mention = `@${bot.name.toLowerCase()}`
      const end = lower.indexOf(mention)
      return end >= 0 && !/[\p{L}\p{N}_]/u.test(lower.charAt(end + mention.length))
    }) ?? null
  )
}

/** The lead among the bots a query matched: fewest active tasks, then team order. Null asks the person. */
export function chooseBotTeamLead<TBot extends NamedBot>(args: {
  matchedBotIds: readonly string[]
  bots: readonly TBot[]
  activeTasksByBot: Readonly<Record<string, number>>
}): TBot | null {
  const load = (bot: TBot): number => args.activeTasksByBot[bot.id] ?? 0
  let lead: TBot | null = null
  for (const bot of args.bots) {
    if (args.matchedBotIds.includes(bot.id) && (lead === null || load(bot) < load(lead))) {
      lead = bot
    }
  }
  return lead
}
