import { botTeamRoomTextWithFileNames } from './bot-team-room-text-paths'

const MAX_QUESTIONS = 2
const CODE_BLOCK = /```[\s\S]*?(?:```|$)/g
// The closing section a session adds to a reply ("Next step", "Siguiente paso"): session notes, not speech.
const SESSION_SECTION =
  /^[ \t]*(?:#{1,6}[ \t]*|[*_]{1,2}[ \t]*)?(?:siguientes?\s+pasos?|next\s+steps?|key\s+learnings?)\b[\s\S]*$/im
const RULE_LINE = /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm
// A dot between word characters (a file name, a decimal) never ends a sentence.
const INNER_DOT = /(?<=[\p{L}\p{N}])\.(?=[\p{L}\p{N}])/gu
const DOT_MARK = '\u0000'
const SENTENCE = /[^.!?\n]*[.!?]+|[^.!?\n]+$/g

function spokenParagraphs(text: string): string[] {
  const withoutSession = text.replace(CODE_BLOCK, '').replace(SESSION_SECTION, '')
  return withoutSession
    .replace(RULE_LINE, '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}

function plainSentences(paragraph: string): string[] {
  const flat = paragraph
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[*_`>]+/g, '')
    .replace(INNER_DOT, DOT_MARK)
  return (flat.match(SENTENCE) ?? [])
    .map((sentence) => sentence.replaceAll(DOT_MARK, '.').trim())
    .filter((sentence) => sentence !== '')
}

/**
 * The question a bot's final reply puts to the person, or null when the reply does not end on one.
 * Only the closing questions are kept: what the bot said before them, its next-step notes and file
 * paths are session internals the room does not need.
 */
export function botTeamQuestionOf(finalReply: string): string | null {
  const last = spokenParagraphs(finalReply).at(-1)
  if (last === undefined) {
    return null
  }
  const sentences = plainSentences(last)
  const questions: string[] = []
  for (let at = sentences.length - 1; at >= 0 && sentences[at].endsWith('?'); at--) {
    questions.unshift(sentences[at])
  }
  if (questions.length === 0) {
    return null
  }
  return botTeamRoomTextWithFileNames(questions.slice(-MAX_QUESTIONS).join(' '))
}
