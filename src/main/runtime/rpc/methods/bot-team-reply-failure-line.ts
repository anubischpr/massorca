import { botTeamReplyLanguage, pickBotTeamLine } from '../../../../shared/bot-team-reply-language'

const LINES = {
  en: 'No one could answer that just now. Mention a bot with @ to ask again.',
  es: 'Nadie pudo responder eso ahora. Menciona a un bot con @ para volver a preguntar.'
}

/** What the team says when a background reply produced nothing: the person can still ask a bot. */
export function botTeamReplyFailureLine(text: string, uiLanguage?: string | null): string {
  return pickBotTeamLine(LINES, botTeamReplyLanguage({ text, uiLanguage }))
}
