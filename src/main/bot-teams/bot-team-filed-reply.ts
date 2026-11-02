/** What the owning bot says in the room once a request is filed; the room shows it under the bot's name. */
export function botTeamFiledReply(input: {
  started: boolean
  later: boolean
  when: 'tomorrow' | 'later' | null
  projectName: string | null
  startError: string | null
}): string {
  const project = input.projectName === null ? '' : ` in ${input.projectName}`
  if (input.startError !== null) {
    return `Added to Todo${project}. It did not start: ${input.startError}`
  }
  // A request kept for later never starts, whatever the caller asked.
  if (input.started && !input.later) {
    return input.projectName === null ? 'On it.' : `On it, in ${input.projectName}.`
  }
  const day =
    input.when === 'tomorrow' ? ' for tomorrow' : input.when === 'later' ? ' for later' : ''
  return `Added to Todo${day}${project}.`
}
