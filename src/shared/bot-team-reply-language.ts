/** The languages a bot-authored room line can be written in. A new one gets a line in every template. */
export const BOT_TEAM_REPLY_LANGUAGES = ['en', 'es'] as const
export type BotTeamReplyLanguage = (typeof BOT_TEAM_REPLY_LANGUAGES)[number]

/** One line per language. English is always there, so a language without its own line reads English. */
export type BotTeamLines<T> = { en: T } & Partial<Record<BotTeamReplyLanguage, T>>

export function pickBotTeamLine<T>(lines: BotTeamLines<T>, language: BotTeamReplyLanguage): T {
  return lines[language] ?? lines.en
}

// A word on both lists would tip the vote either way, so it is on neither.
const SPANISH_WORDS = new Set([
  'hola',
  'buenas',
  'buenos',
  'dias',
  'gracias',
  'favor',
  'que',
  'como',
  'cuando',
  'donde',
  'quien',
  'cual',
  'para',
  'por',
  'con',
  'sin',
  'del',
  'los',
  'las',
  'una',
  'uno',
  'unos',
  'unas',
  'pero',
  'porque',
  'esta',
  'este',
  'esto',
  'eso',
  'ese',
  'esa',
  'ya',
  'si',
  'no',
  'nos',
  'me',
  'mi',
  'mis',
  'hay',
  'tengo',
  'tenemos',
  'puedo',
  'puede',
  'podemos',
  'saben',
  'sabes',
  'quedamos',
  'avance',
  'revisa',
  'revisar',
  'dime',
  'dame',
  'haz',
  'hacer',
  'terminó',
  'terminé',
  'listo',
  'alguien',
  'nadie',
  'sobre',
  'muy',
  'mas',
  'aqui',
  'ahora',
  'hoy',
  'mañana',
  'equipo',
  'tarea',
  'tareas',
  'proyecto',
  'nuestro',
  'nuestra',
  'es',
  'son',
  'el',
  'la',
  'de',
  'en',
  'al',
  'un'
])

const ENGLISH_WORDS = new Set([
  'the',
  'and',
  'is',
  'are',
  'was',
  'were',
  'be',
  'what',
  'when',
  'where',
  'who',
  'why',
  'how',
  'can',
  'could',
  'would',
  'should',
  'will',
  'do',
  'does',
  'did',
  'you',
  'your',
  'we',
  'our',
  'they',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'with',
  'for',
  'from',
  'on',
  'in',
  'at',
  'of',
  'to',
  'not',
  'have',
  'has',
  'had',
  'please',
  'thanks',
  'thank',
  'hello',
  'hi',
  'hey',
  'there',
  'team',
  'task',
  'project',
  'about',
  'check',
  'finish',
  'finished',
  'answer',
  'one',
  'just',
  'tell'
])

const ACCENTED = /[áéíóúüñ]/

/** The language a message is written in, from its words; null when the words do not say. */
export function detectBotTeamReplyLanguage(text: string): BotTeamReplyLanguage | null {
  let spanish = /[¿¡]/.test(text) ? 1 : 0
  let english = 0
  for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
    if (word.length < 2) {
      continue
    }
    if (SPANISH_WORDS.has(word)) {
      spanish += 1
    } else if (ENGLISH_WORDS.has(word)) {
      english += 1
    }
    if (ACCENTED.test(word)) {
      spanish += 1
    }
  }
  if (spanish === english) {
    return null
  }
  return spanish > english ? 'es' : 'en'
}

export function isBotTeamReplyLanguage(value: unknown): value is BotTeamReplyLanguage {
  return BOT_TEAM_REPLY_LANGUAGES.some((language) => language === value)
}

/**
 * The language a host-posted line is written in: the person's message when its words say, else the
 * app's language when the host knows it and the lines exist, else English.
 */
export function botTeamReplyLanguage(args: {
  text?: string | null
  uiLanguage?: string | null
}): BotTeamReplyLanguage {
  return (
    detectBotTeamReplyLanguage(args.text ?? '') ??
    (isBotTeamReplyLanguage(args.uiLanguage) ? args.uiLanguage : 'en')
  )
}
