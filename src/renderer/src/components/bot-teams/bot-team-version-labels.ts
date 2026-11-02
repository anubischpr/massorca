import { translate } from '@/i18n/i18n'
import type { BotTeamVersion } from '../../../../shared/rpc-contract/bot-team-version-params'

export function botTeamVersionTime(createdAt: number): string {
  return new Date(createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** A version's name: the task it saved, or what the person did. */
export function botTeamVersionLabel(version: BotTeamVersion): string {
  if (version.reason === 'restored') {
    return translate('components.botTeams.versionRestored', 'Restored')
  }
  if (version.reason === 'before-restore') {
    return translate('components.botTeams.versionBeforeRestoring', 'Before restoring')
  }
  return version.label
}

/** Who and when; the person is named only for a restore, because only a restore is theirs. */
export function botTeamVersionMeta(version: BotTeamVersion): string {
  const time = botTeamVersionTime(version.createdAt)
  if (version.reason === 'restored') {
    return translate('components.botTeams.restoredByYou', 'Restored by you, {{time}}', { time })
  }
  return version.author ? `${version.author}, ${time}` : time
}

/** What a file row says about its last change, or nothing when the host recorded no one. */
export function botTeamFileChangeMeta(version: BotTeamVersion): string | null {
  const time = botTeamVersionTime(version.createdAt)
  if (version.reason === 'restored') {
    return translate('components.botTeams.restoredByYou', 'Restored by you, {{time}}', { time })
  }
  return version.author
    ? translate('components.botTeams.changedBy', 'Changed by {{name}}, {{time}}', {
        name: version.author,
        time
      })
    : null
}
