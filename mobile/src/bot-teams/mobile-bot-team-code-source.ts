import type { BotTeamCodeSource } from '../../../src/shared/rpc-contract/bot-team-room-params'

/** Where a project's code comes from, with the labels and hints the desktop shows. */
export const BOT_TEAM_CODE_SOURCES: readonly {
  id: BotTeamCodeSource
  label: string
  hint: string
}[] = [
  {
    id: 'repo',
    label: 'Existing repository',
    hint: 'Connect code that already lives in one of your accounts.'
  },
  {
    id: 'folder',
    label: 'New folder with git',
    hint: 'Start a new folder and set it up as a git project.'
  }
]

export function botTeamCodeSourceLabel(source: BotTeamCodeSource): string {
  const option = BOT_TEAM_CODE_SOURCES.find((entry) => entry.id === source)
  return option ? option.label : source
}
