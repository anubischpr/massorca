import React from 'react'
import {
  useRepoGhAccountDisplay,
  type RepoGhAccountDisplay
} from '@/components/repo/use-repo-gh-account-display'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  ghAccountBindingLabel,
  type GhAccountBinding
} from '../../../../../../shared/github/account-binding'
import type { Repo } from '../../../../../../shared/repo-types'
import { isFolderRepo } from '../../../../../../shared/repo-kind'
import { FolderProjectGitMarker } from './FolderProjectGitMarker'

function repoGhAccountTitle(
  account: RepoGhAccountDisplay,
  binding: GhAccountBinding | undefined
): string | undefined {
  if (account.source === 'git-config') {
    const pinned = translate(
      'components.nativeChatSummary.githubAccountGitConfig',
      '{{account}} (git config gh.account)',
      { account: account.label }
    )
    if (!account.mismatch || !binding) {
      return pinned
    }
    const bound = translate(
      'components.nativeChatSummary.githubAccountMismatch',
      'MassOrca binding: {{account}}',
      { account: ghAccountBindingLabel(binding) }
    )
    return `${pinned}\n${bound}`
  }
  if (!binding) {
    return undefined
  }
  return translate(
    'components.nativeChatSummary.githubAccountOrcaBinding',
    '{{account}} ({{host}}) — MassOrca binding',
    { account: binding.user, host: binding.host }
  )
}

/** Repo name plus its GitHub account; the name keeps its width and the account truncates first. */
export function RepoHeaderTitle({
  label,
  repo
}: {
  label: string
  repo: Repo | undefined
}): React.JSX.Element {
  const account = useRepoGhAccountDisplay(repo)
  return (
    <>
      <div
        className={cn(
          'min-w-0 truncate text-[13px] font-semibold leading-none',
          account.label && 'max-w-[70%] shrink-0'
        )}
      >
        {label}
      </div>
      {repo && isFolderRepo(repo) ? <FolderProjectGitMarker repo={repo} /> : null}
      {account.label ? (
        <span
          className="min-w-0 shrink truncate text-xs leading-none text-muted-foreground"
          title={repoGhAccountTitle(account, repo?.ghAccount)}
        >
          {account.label}
        </span>
      ) : null}
    </>
  )
}
