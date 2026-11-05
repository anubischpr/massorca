import { Folder } from 'lucide-react'
import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { isGitHubBackedRepo } from '../../../../shared/project-host-setup-projection'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'
import { RepositoryGitHubAccountSection } from '../settings/RepositoryGitHubAccountSection'

/** Git repos whose remote is on GitHub; folder workspaces and other hosts have no account to pick. */
export function listGitHubProjects(repos: readonly Repo[]): Repo[] {
  return repos.filter((repo) => !isFolderRepo(repo) && isGitHubBackedRepo(repo))
}

/** Each GitHub project and its account picker, on the GitHub Marketplace page. */
export function MarketplaceGitHubProjects(): React.JSX.Element {
  const repos = useAppStore((state) => state.repos)
  const updateRepo = useAppStore((state) => state.updateRepo)
  const projects = useMemo(() => listGitHubProjects(repos), [repos])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        {translate('auto.components.marketplace.MarketplaceGitHubProjects.title', 'Projects')}
      </p>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceGitHubProjects.none',
            'No GitHub projects are added yet.'
          )}
        </p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border bg-card">
          {projects.map((repo) => (
            <ProjectRow
              key={repo.id}
              repo={repo}
              updateRepo={(repoId, updates) =>
                updateRepo(repoId, updates, { hostId: getRepoExecutionHostId(repo) })
              }
            />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceGitHubProjects.help',
          'Pick the account each project on {{host}} uses. MassOrca can also set the project git config to that account and commit as it.',
          { host: 'github.com' }
        )}
      </p>
    </div>
  )
}

function ProjectRow({
  repo,
  updateRepo
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: { ghAccount?: GhAccountBinding | null }) => unknown
}): React.JSX.Element {
  const detail = repo.ghAccount
    ? translate(
        'auto.components.marketplace.MarketplaceGitHubProjects.pinned',
        'Git uses this account'
      )
    : translate(
        'auto.components.marketplace.MarketplaceGitHubProjects.followsActive',
        'Follows the active account'
      )
  return (
    <li className="flex flex-col gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
          <Folder className="size-4 text-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{repo.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <RepositoryGitHubAccountSection repo={repo} updateRepo={updateRepo} forceVisible compact />
    </li>
  )
}
