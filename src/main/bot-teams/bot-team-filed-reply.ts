import { botTeamReplyLanguage, pickBotTeamLine } from '../../shared/bot-team-reply-language'

const DAY = {
  tomorrow: { en: ' for tomorrow', es: ' para mañana' },
  later: { en: ' for later', es: ' para más tarde' }
} as const

/**
 * What the owning bot says in the room once a request is filed; the room shows it under the bot's
 * name. The line is in the language of the request, else of the app.
 */
export function botTeamFiledReply(input: {
  started: boolean
  later: boolean
  when: 'tomorrow' | 'later' | null
  projectName: string | null
  startError: string | null
  /** The person's request, whose language the line answers in. */
  text?: string | null
  /** The app's language, for a request whose words do not say. */
  uiLanguage?: string | null
}): string {
  const language = botTeamReplyLanguage({ text: input.text, uiLanguage: input.uiLanguage })
  const project =
    input.projectName === null
      ? ''
      : pickBotTeamLine(
          { en: ` in ${input.projectName}`, es: ` en ${input.projectName}` },
          language
        )
  if (input.startError !== null) {
    return pickBotTeamLine(
      {
        en: `Added to Todo${project}. It did not start: ${input.startError}`,
        es: `Añadido a Todo${project}. No se inició: ${input.startError}`
      },
      language
    )
  }
  // A request kept for later never starts, whatever the caller asked.
  if (input.started && !input.later) {
    return input.projectName === null
      ? pickBotTeamLine({ en: 'On it.', es: 'En ello.' }, language)
      : pickBotTeamLine(
          { en: `On it, in ${input.projectName}.`, es: `En ello, en ${input.projectName}.` },
          language
        )
  }
  const day = input.when === null ? '' : pickBotTeamLine(DAY[input.when], language)
  return pickBotTeamLine(
    { en: `Added to Todo${day}${project}.`, es: `Añadido a Todo${day}${project}.` },
    language
  )
}

/** What the owning bot says when a request is scheduled to run once: the day and time it starts. */
export function botTeamScheduledReply(input: {
  date: string
  time: string
  text?: string | null
  uiLanguage?: string | null
}): string {
  const language = botTeamReplyLanguage({ text: input.text, uiLanguage: input.uiLanguage })
  const [year, month, day] = input.date.split('-').map(Number)
  // The host's own date, drawn as written whatever zone formats it.
  const label = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    language === 'es' ? 'es' : 'en-US',
    { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
  )
  return pickBotTeamLine(
    {
      en: `Scheduled for ${label} at ${input.time}. It starts then; until it does it waits in Todo and in the Calendar.`,
      es: `Programado para el ${label} a las ${input.time}. Empieza a esa hora; hasta entonces espera en Todo y en el Calendario.`
    },
    language
  )
}

const START_ACKNOWLEDGEMENT = /^(?:on it|en ello)\b/i

/** Whether a bot line is only the room's "On it." that says its task started. */
export function isBotTeamStartAcknowledgement(text: string): boolean {
  return START_ACKNOWLEDGEMENT.test(text.trim())
}
