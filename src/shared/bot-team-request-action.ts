/** Lowercase words with accents dropped and punctuation as spaces. */
function plainWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/@\S+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
}

// Imperatives that ask for something to be made, in Spanish and English (accents are dropped).
const MAKING_VERBS = new Set([
  'crea',
  'crear',
  'creame',
  'genera',
  'generar',
  'generame',
  'haz',
  'hazme',
  'hacer',
  'arma',
  'armar',
  'preparame',
  'prepara',
  'preparar',
  'redacta',
  'redactar',
  'escribe',
  'escribir',
  'disena',
  'disenar',
  'elabora',
  'elaborar',
  'construye',
  'agrega',
  'anade',
  'create',
  'make',
  'build',
  'write',
  'generate',
  'draft',
  'prepare',
  'design',
  'produce',
  'add'
])

// What may come before the verb: courtesy, or a question that asks for the action.
const LEADING_WORDS = new Set([
  'por',
  'favor',
  'please',
  'puedes',
  'podrias',
  'puede',
  'podria',
  'can',
  'could',
  'you',
  'would',
  'quiero',
  'que',
  'necesito',
  'ahora',
  'ya',
  'y',
  'ok',
  'ahi',
  'hola',
  'hey',
  'hi'
])

// How many words may stand before the verb, so a sentence that merely contains one is not an order.
const MAX_LEADING = 4

/**
 * Whether the message is an order to make something ("crea una tarjeta de opciones"), not a question
 * or chat about it. Such a message is work for a bot, whatever the query first made of it.
 */
export function isBotTeamActionRequest(text: string): boolean {
  const words = plainWords(text)
  for (let index = 0; index < Math.min(words.length, MAX_LEADING + 1); index += 1) {
    if (MAKING_VERBS.has(words[index])) {
      return true
    }
    if (!LEADING_WORDS.has(words[index])) {
      return false
    }
  }
  return false
}

const UNIVERSAL_THINGS = [
  /\btarjetas? de opcion(?:es)?\b/,
  /\bopcion cards?\b/,
  /\boption cards?\b/,
  /\bcards? de opcion(?:es)?\b/,
  /\bartefactos?\b/,
  /\bartifacts?\b/
]

/** Whether the message asks for something every bot can make: an option card or a MassOrca artifact. */
export function asksForUniversalBotCapability(text: string): boolean {
  const plain = plainWords(text).join(' ')
  return UNIVERSAL_THINGS.some((pattern) => pattern.test(plain))
}
