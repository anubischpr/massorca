/** The author of the room's greeting line: the whole team, not one bot. */
export const BOT_TEAM_ALL_AUTHOR = 'all'

const GREETINGS = [
  'hola',
  'holi',
  'holaa',
  'buenas',
  'buen dia',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'hello',
  'hi',
  'hey',
  'good morning',
  'good afternoon',
  'good evening'
]
const TEAM_WORDS = /\s+(?:team|equipo|todos|everyone|all)$/

/** Only a message that is nothing but a greeting: "Hola, revisa esto" is a real request. */
export function isBotTeamGreeting(text: string): boolean {
  const plain = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(TEAM_WORDS, '')
  return GREETINGS.includes(plain.replace(/(.)\1+$/, '$1')) || GREETINGS.includes(plain)
}

const SPANISH_LINES = [
  'Hola',
  'Buenas',
  '¡Aquí estamos',
  'Hola, ya estamos todos',
  'Presentes',
  'Aquí el team'
]
const ENGLISH_LINES = ['Hello', 'Hi there', 'We are all here', 'Hey team here', 'Ready when you are']
const EMOJI = ['👋', '🙌', '✨', '🎉', '😄', '🤖', '🌟', '🤝']

function isSpanish(text: string): boolean {
  return /hola|holi|buen/i.test(text)
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length]
}

/** One rotating line from the whole team; never the same as the last one when another exists. */
export function botTeamGreetingLine(args: {
  text: string
  previous?: string | null
  random?: () => number
}): string {
  const random = args.random ?? Math.random
  const lines = isSpanish(args.text) ? SPANISH_LINES : ENGLISH_LINES
  const build = (): string => {
    const words = pick(lines, random)
    const marks = '!'.repeat(1 + Math.floor(random() * 3))
    const emoji = Array.from({ length: 1 + Math.floor(random() * 2) }, () => pick(EMOJI, random))
    return `${words}${marks} ${emoji.join('')}`
  }
  let line = build()
  for (let tries = 0; line === args.previous && tries < 8; tries += 1) {
    line = build()
  }
  if (line === args.previous) {
    return `${line}${pick(EMOJI, () => 0)}`
  }
  return line
}
