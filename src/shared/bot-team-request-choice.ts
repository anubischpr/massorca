/** A question the room puts to the person when no bot of the team can simply take the request. */
export type BotTeamRequestChoice =
  /** The request fits the team, but no bot covers it. */
  | { kind: 'new-bot' }
  /** The request fits no team that exists. */
  | { kind: 'new-team' }
  /** The request fits another existing team, which the person may change. */
  | { kind: 'other-team'; teamId: string }
