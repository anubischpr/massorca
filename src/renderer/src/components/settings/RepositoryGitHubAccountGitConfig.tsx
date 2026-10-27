import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type {
  GhAccountGitConfigResult,
  GhAccountGitConfigState
} from '../../../../shared/github/gh-account-git-config'
import type { Repo } from '../../../../shared/repo-types'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { translate } from '@/i18n/i18n'
import {
  applyRepositoryGhAccountGitConfig,
  readRepositoryGhAccountGitConfig
} from './repository-github-account'
import type { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'

type RuntimeTarget = ReturnType<typeof getActiveRuntimeTarget>

type GitConfigMessage = { tone: 'error' | 'info'; text: string }

function describeFailure(result: Extract<GhAccountGitConfigResult, { ok: false }>): string {
  switch (result.error) {
    case 'folder_workspace':
      return translate(
        'auto.components.settings.RepositoryGitHubAccountGitConfig.folderWorkspace',
        'Folder projects have no git config to update.'
      )
    case 'unsafe_login':
      return translate(
        'auto.components.settings.RepositoryGitHubAccountGitConfig.unsafeLogin',
        'This login contains characters that cannot be written to a git credential helper.'
      )
    case 'ssh_unavailable':
      return translate(
        'auto.components.settings.RepositoryGitHubAccountGitConfig.sshUnavailable',
        'The SSH connection for this project is not connected. Reconnect and pick the account again.'
      )
    case 'git_failed':
      return translate(
        'auto.components.settings.RepositoryGitHubAccountGitConfig.gitFailed',
        'Could not update the git config: {{message}}',
        { message: result.message ?? '' }
      )
  }
}

/** Reads and writes the repo-local git config pin that mirrors `Repo.ghAccount`. */
export function useRepositoryGhAccountGitConfig(
  runtimeTarget: RuntimeTarget,
  repo: Pick<Repo, 'id' | 'path'>
) {
  const [state, setState] = useState<GhAccountGitConfigState | null>(null)
  const [identityOptIn, setIdentityOptIn] = useState(false)
  const [message, setMessage] = useState<GitConfigMessage | null>(null)
  const generationRef = useRef(0)
  const repoId = repo.id
  const repoPath = repo.path

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current
    try {
      const next = await readRepositoryGhAccountGitConfig(runtimeTarget, {
        id: repoId,
        path: repoPath
      })
      if (generation === generationRef.current) {
        setState(next)
        setIdentityOptIn(next?.identityManaged ?? false)
      }
    } catch {
      // Why: older runtimes lack the read method; the pin status is informational only.
      if (generation === generationRef.current) {
        setState(null)
      }
    }
  }, [runtimeTarget, repoId, repoPath])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const apply = useCallback(
    async (
      next: GhAccountBinding | null,
      previous: GhAccountBinding | null,
      setIdentity: boolean
    ) => {
      setMessage(null)
      try {
        const result = await applyRepositoryGhAccountGitConfig(
          runtimeTarget,
          { id: repoId, path: repoPath },
          {
            next,
            previous,
            setIdentity
          }
        )
        if (!result.ok) {
          setMessage({ tone: 'error', text: describeFailure(result) })
        } else if (result.identity === 'unavailable') {
          setMessage({
            tone: 'info',
            text: translate(
              'auto.components.settings.RepositoryGitHubAccountGitConfig.identityUnavailable',
              'Account pinned, but its noreply email could not be looked up, so the commit author was left unchanged.'
            )
          })
        }
      } catch (err) {
        setMessage({
          tone: 'error',
          text: translate(
            'auto.components.settings.RepositoryGitHubAccountGitConfig.gitFailed',
            'Could not update the git config: {{message}}',
            { message: err instanceof Error ? err.message : String(err) }
          )
        })
      }
      await refresh()
    },
    [runtimeTarget, repoId, repoPath, refresh]
  )

  return { state, identityOptIn, setIdentityOptIn, apply, message }
}

type ControlsProps = {
  gitConfig: ReturnType<typeof useRepositoryGhAccountGitConfig>
  binding: GhAccountBinding | null
  disabled: boolean
}

export function RepositoryGitHubAccountGitConfigControls({
  gitConfig,
  binding,
  disabled
}: ControlsProps): React.JSX.Element {
  const switchId = useId()
  const { state, identityOptIn, setIdentityOptIn, apply, message } = gitConfig
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {state?.account
          ? translate(
              'auto.components.settings.RepositoryGitHubAccountGitConfig.pinned',
              'Git config pins this repository to {{account}}: git push and the gh shell wrapper use that account.',
              { account: state.account }
            )
          : translate(
              'auto.components.settings.RepositoryGitHubAccountGitConfig.notPinned',
              'Picking an account also writes gh.account and a credential helper to this repository’s local git config.'
            )}
      </p>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={switchId}>
            {translate(
              'auto.components.settings.RepositoryGitHubAccountGitConfig.identityLabel',
              'Commit as this account'
            )}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.RepositoryGitHubAccountGitConfig.identityDescription',
              'Sets user.name and user.email to the account’s GitHub noreply address in this repository.'
            )}
          </p>
        </div>
        <Switch
          id={switchId}
          checked={identityOptIn}
          disabled={disabled}
          onCheckedChange={(checked) => {
            setIdentityOptIn(checked)
            if (binding) {
              void apply(binding, binding, checked)
            }
          }}
        />
      </div>
      {message?.tone === 'error' ? (
        <p className="text-xs text-destructive">{message.text}</p>
      ) : null}
      {message?.tone === 'info' ? (
        <p className="text-xs text-muted-foreground">{message.text}</p>
      ) : null}
    </div>
  )
}
