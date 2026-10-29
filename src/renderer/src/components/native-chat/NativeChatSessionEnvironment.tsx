import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useRepoGhAccountDisplay } from '@/components/repo/use-repo-gh-account-display'
import { useAppStore } from '@/store'
import { useRepoSlugIndex } from '@/lib/repo-slug-index'
import { readRepoSlugCache, settingsForRepoOwner, slugCacheKey } from '@/lib/repo-slug-cache'
import { isFolderRepo } from '../../../../shared/repo-kind'
import { ghAccountBindingLabel } from '../../../../shared/github/account-binding'
import type { NativeChatFileLinkContext } from './native-chat-file-link'
import { NativeChatSessionField, NativeChatSessionSection } from './NativeChatSessionSection'
import {
  githubSlugFromIdentityKey,
  workspaceBranchName,
  workspaceFolderName
} from './native-chat-session-summary'

/** The workspace the chat runs in: project, folder, path, worktree, and branch on its host. */
export function NativeChatSessionEnvironment({
  fileContext,
  host
}: {
  fileContext: NativeChatFileLinkContext | null
  host: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const unavailable = t('components.nativeChatSummary.unavailable', 'Unavailable')
  const worktreeId = fileContext?.worktreeId
  const worktree = useAppStore((state) =>
    Object.values(state.worktreesByRepo)
      .flat()
      .find((entry) => entry.id === worktreeId)
  )
  const repo = useAppStore((state) => state.repos.find((entry) => entry.id === worktree?.repoId))
  const settings = useAppStore((state) => state.settings)
  // Why: the index resolves each repo's GitHub slug into the shared cache and re-renders once it lands.
  useRepoSlugIndex()
  const slugKey = repo ? slugCacheKey(repo.id, settingsForRepoOwner(repo, settings)) : null
  const cachedSlug = slugKey ? readRepoSlugCache(slugKey) : null
  const slug =
    cachedSlug?.hit && cachedSlug.value ? githubSlugFromIdentityKey(cachedSlug.value) : null
  const project = slug ?? (repo?.displayName.trim() || unavailable)
  const path = fileContext?.worktreePath ?? null
  const folder = path ? workspaceFolderName(path) : null
  const isFolderWorkspace = repo ? isFolderRepo(repo) : false
  const branch = workspaceBranchName(worktree?.branch)
  const worktreeName = worktree?.displayName.trim() || null
  // Why: the repo's own gh.account pin, else its Orca binding; never the globally active gh account.
  const accountDisplay = useRepoGhAccountDisplay(repo)
  const githubAccount = accountDisplay.label
  const noGithubAccount = t('components.nativeChatSummary.noGithubAccount', 'No account bound')
  const compact = (
    <>
      <p className="truncate">{githubAccount ?? noGithubAccount}</p>
      <p className="truncate">{project}</p>
      <p className="truncate">
        {isFolderWorkspace ? (folder ?? unavailable) : (branch ?? unavailable)}
      </p>
      <p className="truncate">{worktreeName ?? unavailable}</p>
    </>
  )
  return (
    <NativeChatSessionSection
      title={t('components.nativeChatSummary.environment', 'Environment')}
      summary={host}
      compact={compact}
    >
      <dl className="space-y-2">
        <NativeChatSessionField
          label={t('components.nativeChatSummary.host', 'Execution host')}
          value={host}
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.githubAccount', 'GitHub account')}
          value={
            <>
              <span className="block">{githubAccount ?? noGithubAccount}</span>
              {accountDisplay.mismatch && repo?.ghAccount ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(
                    'components.nativeChatSummary.githubAccountMismatch',
                    'MassOrca binding: {{account}}',
                    { account: ghAccountBindingLabel(repo.ghAccount) }
                  )}
                </span>
              ) : null}
            </>
          }
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.project', 'Project')}
          value={project}
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.folder', 'Folder')}
          value={folder ?? unavailable}
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.path', 'Path')}
          value={
            path ? (
              <>
                <span className="block select-text">{path}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => void navigator.clipboard.writeText(path).catch(() => undefined)}
                >
                  <Copy />
                  {t('components.nativeChatSummary.copyPath', 'Copy path')}
                </Button>
              </>
            ) : (
              unavailable
            )
          }
        />
        <NativeChatSessionField
          label={t('components.nativeChatSummary.worktree', 'Worktree')}
          value={worktreeName ?? unavailable}
        />
        {isFolderWorkspace ? null : (
          <NativeChatSessionField
            label={t('components.nativeChatSummary.branch', 'Branch')}
            value={branch ?? unavailable}
          />
        )}
      </dl>
    </NativeChatSessionSection>
  )
}
