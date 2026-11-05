// Keywords that ask for a prototype, in the user's own words. Matching is whole-word, case- and
// accent-insensitive, and never calls a model.

// Each matches on its own.
export const PROTOTYPE_POSITIVE_TERMS: readonly string[] = [
  'prototype',
  'prototypes',
  'prototipo',
  'prototipos',
  'mockup',
  'mockups',
  'mock-up',
  'mock-ups',
  'maqueta',
  'maquetas',
  'wireframe',
  'wireframes',
  'wireframing',
  'maquetar',
  'prototipar',
  'prototipe',
  'prototipen',
  'prototipado',
  'prototipando',
  'prototyping'
]

// Each matches only with a UI noun from PROTOTYPE_UI_NOUNS in the same sentence, at most ten words away.
// Maquetación, boceto and bosquejo also name print layouts or ordinary drafts, so they need the noun too.
export const PROTOTYPE_DESIGN_TERMS: readonly string[] = [
  'design',
  'designs',
  'designing',
  'designed',
  'designer',
  'designers',
  'redesign',
  'redesigning',
  'diseño',
  'diseños',
  'diseñar',
  'diseña',
  'diseñas',
  'diseñamos',
  'diseñan',
  'diseñe',
  'diseñes',
  'diseñen',
  'diseñemos',
  'diseñéis',
  'diseñad',
  'diseñando',
  'diseñado',
  'diseñada',
  'diseñados',
  'diseñadas',
  'diseñaría',
  'diseñarían',
  'diseñame',
  'diséñame',
  'rediseño',
  'rediseñar',
  'rediseña',
  'rediseñas',
  'rediseñamos',
  'rediseñan',
  'rediseñe',
  'rediseñes',
  'rediseñen',
  'rediseñemos',
  'rediseñando',
  'rediseñado',
  'rediseñada',
  'rediseñados',
  'rediseñadas',
  'maquetación',
  'boceto',
  'bocetos',
  'bosquejo',
  'bosquejos'
]

export const PROTOTYPE_UI_NOUNS: readonly string[] = [
  'pantalla',
  'pantallas',
  'screen',
  'screens',
  'app screen',
  'landing',
  'landing page',
  'ui',
  'interfaz',
  'interfaces',
  'interface',
  'página',
  'páginas',
  'page',
  'pages',
  'componente',
  'componentes',
  'component',
  'components',
  'vista',
  'vistas',
  'view',
  'views',
  'dashboard',
  'dashboards',
  'formulario',
  'formularios',
  'form',
  'forms',
  'onboarding',
  'checkout',
  'botón',
  'botones',
  'button',
  'buttons',
  'menú',
  'menús',
  'menu',
  'menus',
  'modal',
  'modals',
  'layout',
  'layouts'
]

// A message with any of these is never a prototype request, wherever they appear. A bare
// "pattern" is not listed: a background pattern is a UI request.
export const PROTOTYPE_NEGATIVE_TERMS: readonly string[] = [
  'base de datos',
  'database',
  'databases',
  'db schema',
  'schema',
  'schemas',
  'esquema',
  'esquemas',
  'arquitectura',
  'architecture',
  'API',
  'APIs',
  'endpoint',
  'endpoints',
  'design doc',
  'design docs',
  'documento de diseño',
  'system design',
  'diseño técnico',
  'technical design',
  'data model',
  'data models',
  'modelo de datos',
  'modelos de datos',
  'diseño de software',
  'software design',
  'patrón de diseño',
  'patrones de diseño',
  'design pattern',
  'design patterns'
]

const UI_NOUN_WINDOW = 10
// A flow word between the design word and the noun makes it a flow request, not a screen request.
const FLOW_WORDS: ReadonlySet<string> = new Set(['flow', 'flows', 'flujo', 'flujos'])
const SENTENCE_BREAK = /[.!?;\n]+/u
const WORD_PATTERN = /[\p{L}\p{N}_]+/gu

type Phrase = readonly string[]

// Lowercase words with accents removed; spaces, hyphens and punctuation separate them.
function wordsOf(text: string): string[] {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(WORD_PATTERN) ?? []
}

const positivePhrases = PROTOTYPE_POSITIVE_TERMS.map((term) => wordsOf(term))
const designPhrases = PROTOTYPE_DESIGN_TERMS.map((term) => wordsOf(term))
const uiNounPhrases = PROTOTYPE_UI_NOUNS.map((term) => wordsOf(term))
const negativePhrases = PROTOTYPE_NEGATIVE_TERMS.map((term) => wordsOf(term))

// Typos are tolerated only for single words of at least five letters, against design terms and UI nouns.
const FUZZY_MIN_LENGTH = 5
// Real word families one edit away from a design term or UI noun: a token that starts with one keeps
// its own meaning (resigned, designar, designación), so no inflection of these slips into design.
const FUZZY_EXEMPT_FAMILIES: readonly string[] = [
  'resign',
  'deign',
  'designa',
  'designo',
  'designe',
  'lista',
  'visto',
  'menos',
  'model',
  'medal',
  'modas',
  'pagos',
  'pagas',
  'lending',
  'terms',
  'botin',
  'desena'
]

function isFuzzyExempt(word: string): boolean {
  return FUZZY_EXEMPT_FAMILIES.some((family) => word.startsWith(family))
}
const FUZZY_TERMS: ReadonlySet<string> = new Set(
  [...designPhrases, ...uiNounPhrases]
    .filter((phrase) => phrase.length === 1)
    .map((phrase) => phrase[0] ?? '')
    .filter((word) => word.length >= FUZZY_MIN_LENGTH)
)
const FUZZY_TERMS_BY_LENGTH: ReadonlyMap<number, readonly string[]> = groupByLength([
  ...FUZZY_TERMS
])

function groupByLength(words: readonly string[]): Map<number, string[]> {
  const groups = new Map<number, string[]>()
  for (const word of words) {
    const group = groups.get(word.length)
    if (group) {
      group.push(word)
    } else {
      groups.set(word.length, [word])
    }
  }
  return groups
}

// True when two different words differ by one substitution, insertion, deletion or adjacent transposition.
function isOneEditApart(word: string, term: string): boolean {
  let start = 0
  while (start < word.length && start < term.length && word[start] === term[start]) {
    start += 1
  }
  if (word.length === term.length) {
    if (word.slice(start + 1) === term.slice(start + 1)) {
      return true
    }
    return (
      start + 1 < word.length &&
      word[start] === term[start + 1] &&
      word[start + 1] === term[start] &&
      word.slice(start + 2) === term.slice(start + 2)
    )
  }
  const [longer, shorter] = word.length > term.length ? [word, term] : [term, word]
  return longer.length === shorter.length + 1 && longer.slice(start + 1) === shorter.slice(start)
}

// Replaces a typo of a design term or UI noun with that term; every other word is kept as written.
function canonicalWords(words: readonly string[]): string[] {
  return words.map((word) => {
    if (word.length < FUZZY_MIN_LENGTH || FUZZY_TERMS.has(word) || isFuzzyExempt(word)) {
      return word
    }
    for (let length = word.length - 1; length <= word.length + 1; length += 1) {
      for (const term of FUZZY_TERMS_BY_LENGTH.get(length) ?? []) {
        if (isOneEditApart(word, term)) {
          return term
        }
      }
    }
    return word
  })
}

// The index of each place where a phrase occurs in the words.
function occurrences(words: readonly string[], phrases: readonly Phrase[]): number[] {
  const starts: number[] = []
  for (const phrase of phrases) {
    if (phrase.length === 0) {
      continue
    }
    for (let start = 0; start + phrase.length <= words.length; start += 1) {
      if (phrase.every((word, offset) => words[start + offset] === word)) {
        starts.push(start)
      }
    }
  }
  return starts
}

// The first index whose value is at least `value`, in an ascending list.
function firstAtOrAfter(ascending: readonly number[], value: number): number {
  let low = 0
  let high = ascending.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if ((ascending[middle] ?? Number.POSITIVE_INFINITY) < value) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

// Each design word checks only the UI nouns in its window, found by binary search, so a long message
// costs time in its words rather than in every pair of a design word and a noun.
function designNearUiNoun(rawWords: readonly string[]): boolean {
  const words = canonicalWords(rawWords)
  const nounStarts = occurrences(words, uiNounPhrases).sort((left, right) => left - right)
  return occurrences(words, designPhrases).some((verb) => {
    const first = firstAtOrAfter(nounStarts, verb - UI_NOUN_WINDOW)
    for (let index = first; index < nounStarts.length; index += 1) {
      const noun = nounStarts[index]
      if (noun === undefined || noun > verb + UI_NOUN_WINDOW) {
        return false
      }
      const between = words.slice(Math.min(verb, noun) + 1, Math.max(verb, noun))
      if (!between.some((w) => FLOW_WORDS.has(w))) {
        return true
      }
    }
    return false
  })
}

/** True when the text asks for a prototype: a positive term, or a design term near a UI noun. */
export function hasPrototypeKeyword(text: string): boolean {
  const words = wordsOf(text)
  if (occurrences(words, negativePhrases).length > 0) {
    return false
  }
  if (occurrences(words, positivePhrases).length > 0) {
    return true
  }
  return text.split(SENTENCE_BREAK).some((sentence) => designNearUiNoun(wordsOf(sentence)))
}

/** True when the text names a design or a UI screen, even if a negative term applies. */
export function hasDesignWording(text: string): boolean {
  const words = canonicalWords(wordsOf(text))
  return occurrences(words, [...positivePhrases, ...designPhrases, ...uiNounPhrases]).length > 0
}
