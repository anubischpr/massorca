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
