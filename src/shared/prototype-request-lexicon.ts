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
  'wireframes'
]

// Each matches only with a UI noun from PROTOTYPE_UI_NOUNS in the same sentence, at most ten words away.
export const PROTOTYPE_DESIGN_TERMS: readonly string[] = [
  'design',
  'designs',
  'designing',
  'redesign',
  'diseño',
  'diseños',
  'diseñar',
  'diseña',
  'diseñame',
  'diséñame',
  'rediseño',
  'rediseñar',
  'rediseña'
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
function designNearUiNoun(words: readonly string[]): boolean {
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
