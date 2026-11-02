/** When a request wants its work later: tomorrow, some later time, or just filed in Todo. */
export type BotTeamRequestTiming = { later: boolean; when: 'tomorrow' | 'later' | null }

// Accents are dropped first, so "mañana" reads as "manana".
const TOMORROW = /(?:^|[^a-z])(?:pasado\s+)?manana(?![a-z])|\btomorrow\b/
const LATER = /\bmas tarde\b|\bpara luego\b|\blater\b|\bproxima semana\b|\bnext week\b/
// A verb of filing, then the Todo column that ends the phrase: "agréguenlo al Todo", not "en todo el sitio".
const TODO =
  /\b(?:agreg\w*|agrega\w*|anot\w*|guard\w*|pon\w*|mete\w*|add|save)\b[^.!?\n]{0,60}?\b(?:al|en|to|in)\s+(?:todo|to do|to-do|todo list)(?=\s*(?:$|[.,;!?]|\s(?:por favor|please|gracias|thanks|para|for)\b))/

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * The conservative reading of a request's timing. "Esta mañana" names the morning, so it is not
 * tomorrow; a request is later only with a clear day, a later time, or a filing into Todo.
 */
export function botTeamRequestTiming(text: string): BotTeamRequestTiming {
  const value = plain(text).replace(/\b(?:esta|por la|en la|de la)\s+manana\b/g, ' ')
  const when = TOMORROW.test(value) ? 'tomorrow' : LATER.test(value) ? 'later' : null
  return { later: when !== null || TODO.test(value), when }
}
