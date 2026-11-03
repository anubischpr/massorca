type NamedBot = { id: string; name: string }
type DescribedBot = NamedBot & { job: string }

/** Words that say nothing about a subject; a bot and a request do not match on them. */
const REQUEST_FILLER = new Set([
  'para',
  'pero',
  'como',
  'tengo',
  'sino',
  'esta',
  'este',
  'estas',
  'estos',
  'esos',
  'esas',
  'esto',
  'eso',
  'hoy',
  'manana',
  'todo',
  'todos',
  'toda',
  'tarea',
  'tareas',
  'favor',
  'hacer',
  'necesito',
  'quiero',
  'agrega',
  'agregalo',
  'agreguenlo',
  'crear',
  'revisa',
  'revisar',
  'analizar',
  'pendiente',
  'with',
  'that',
  'this',
  'from',
  'have',
  'need',
  'want',
  'make',
  'task',
  'please',
  'about',
  'into',
  'your',
  'the',
  'and',
  'for'
])

/** Lowercase words with accents dropped, so "aplicaciónes" and "aplicaciones" are one word. */
function wordsOf(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
}

function subjectWords(text: string): Set<string> {
  return new Set(wordsOf(text).filter((word) => word.length >= 4 && !REQUEST_FILLER.has(word)))
}

/** The bot named as `@Name` in a request; a mentioned bot takes the request without any query. */
export function findMentionedBot<TBot extends NamedBot>(
  text: string,
  bots: readonly TBot[]
): TBot | null {
  const lower = text.toLowerCase()
  return (
    bots.find((bot) => {
      const mention = `@${bot.name.toLowerCase()}`
      // Every occurrence counts: "@Maximo" must not hide a later "@Max".
      for (
        let at = lower.indexOf(mention);
        at >= 0;
        at = lower.indexOf(mention, at + mention.length)
      ) {
        if (!/[\p{L}\p{N}_]/u.test(lower.charAt(at + mention.length))) {
          return true
        }
      }
      return false
    }) ?? null
  )
}

/**
 * The bots by how many subject words their name and job share with a request, best first. Team
 * order keeps ties, so a request with no shared word ranks the bots as the team lists them.
 */
export function rankBotsForRequest<TBot extends DescribedBot>(
  text: string,
  bots: readonly TBot[]
): { bot: TBot; score: number }[] {
  const subject = subjectWords(text)
  return bots
    .map((bot) => ({
      bot,
      score: [...subjectWords(`${bot.name} ${bot.job}`)].filter((word) => subject.has(word)).length
    }))
    .sort((a, b) => b.score - a.score)
}

/** The project a request names, as its name appears in the words of the request; the longest name wins. */
export function findNamedProject<TProject extends { id: string; name: string }>(
  text: string,
  projects: readonly TProject[]
): TProject | null {
  const words = ` ${wordsOf(text).join(' ')} `
  let best: TProject | null = null
  let bestLength = 0
  for (const project of projects) {
    const name = wordsOf(project.name).join(' ')
    if (name !== '' && words.includes(` ${name} `) && name.length > bestLength) {
      best = project
      bestLength = name.length
    }
  }
  return best
}

/** The owner among the bots a query matched: fewest active tasks, then team order. Null asks the person. */
export function chooseBotTeamOwner<TBot extends NamedBot>(args: {
  matchedBotIds: readonly string[]
  bots: readonly TBot[]
  activeTasksByBot: Readonly<Record<string, number>>
}): TBot | null {
  const load = (bot: TBot): number => args.activeTasksByBot[bot.id] ?? 0
  let owner: TBot | null = null
  for (const bot of args.bots) {
    if (args.matchedBotIds.includes(bot.id) && (owner === null || load(bot) < load(owner))) {
      owner = bot
    }
  }
  return owner
}
