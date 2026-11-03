const SPANISH = /[¿¡ñáéíóú]|\b(hola|qué|cómo|como|puedo|puede|para|equipo|saben)\b/i

/** What the team says when a background reply produced nothing: the person can still ask a bot. */
export function botTeamReplyFailureLine(text: string): string {
  return SPANISH.test(text)
    ? 'Nadie pudo responder eso ahora. Menciona a un bot con @ para volver a preguntar.'
    : 'No one could answer that just now. Mention a bot with @ to ask again.'
}
