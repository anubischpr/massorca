/** Session option keys that mark a session as one bot's run; they survive restarts with the record. */
export const BOT_RUN_BOT_ID_OPTION = 'botTeamBotId'
export const BOT_RUN_TEAM_ID_OPTION = 'botTeamId'
export const BOT_RUN_OPTION_KEYS = [BOT_RUN_BOT_ID_OPTION, BOT_RUN_TEAM_ID_OPTION] as const
