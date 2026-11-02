/** A question the room puts to the person when no bot of the team can simply take the request. */
export type BotTeamRequestChoice =
  /** The request fits the team, but no bot covers it. `suggestedBotId` is picked first when a reading names one. */
  | { kind: 'new-bot'; suggestedBotId?: string }
  /** The request fits no team that exists. */
  | { kind: 'new-team' }
  /** The request fits another existing team, which the person may change. */
  | { kind: 'other-team'; teamId: string }
  /** The team has projects and the request names none: the person picks one, or none, then it is filed. */
  | { kind: 'project'; botId: string; alsoNeeds?: string[] }
