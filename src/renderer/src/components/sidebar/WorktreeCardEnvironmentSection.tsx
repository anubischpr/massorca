import React from 'react'

import { useRepoGhAccountDisplay } from '@/components/repo/use-repo-gh-account-display'
import { NativeChatSessionField } from '@/components/native-chat/NativeChatSessionSection'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  WorktreeCardDetailSection,
  WorktreeCardDetailSectionContent
} from './WorktreeCardDetailSection'

/**
 * Worktree, host, account and path for the branch hover card. The one-line row drops them from the
 * list; the Environment card still shows the same facts for the open session.
 */
export function WorktreeCardEnvironmentSection({
  worktree,
  repo,
  host
}: {
  worktree: Worktree
  repo: Repo | undefined
  host: string
}): React.JSX.Element {
  // Why: the repo's own gh.account pin, else its Orca binding; never the globally active gh account.
  const account = useRepoGhAccountDisplay(repo)
  return (
    <WorktreeCardDetailSection data-worktree-card-environment="">
      <div className="text-[11px] font-medium text-muted-foreground">
        {translate('components.nativeChatSummary.environment', 'Environment')}
      </div>
      <WorktreeCardDetailSectionContent>
        <dl className="space-y-1.5">
          <NativeChatSessionField
            label={translate('components.nativeChatSummary.worktree', 'Worktree')}
            value={worktree.displayName}
          />
          <NativeChatSessionField
            label={translate('components.nativeChatSummary.host', 'Execution host')}
            value={host}
          />
          <NativeChatSessionField
            label={translate('components.nativeChatSummary.githubAccount', 'GitHub account')}
            value={
              account.label ??
              translate('components.nativeChatSummary.noGithubAccount', 'No account bound')
            }
          />
          <NativeChatSessionField
            label={translate('components.nativeChatSummary.path', 'Path')}
            value={<span className="break-all font-mono text-[11px]">{worktree.path}</span>}
          />
        </dl>
      </WorktreeCardDetailSectionContent>
    </WorktreeCardDetailSection>
  )
}
