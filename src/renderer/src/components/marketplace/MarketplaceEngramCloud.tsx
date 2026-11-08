import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  EngramCloudActionResult,
  EngramCloudProject,
  EngramCloudProjectsResult
} from '../../../../shared/marketplace-engram-ops'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'
import { relativeTimeAgo } from './marketplace-vault-credential-text'

const KEY = 'auto.components.marketplace.MarketplaceEngramCloud'

type Failure = Extract<EngramCloudProjectsResult | EngramCloudActionResult, { ok: false }>['reason']

/** Why a cloud step stopped, in plain words; never the program's own output. */
export function engramCloudFailureMessage(reason: Failure): string {
  switch (reason) {
    case 'not-installed':
      return translate(`${KEY}.notInstalled`, 'Engram is not installed on this computer.')
    case 'no-server':
      return translate(
        `${KEY}.noServer`,
        'Add your Engram server address and sign-in first, then try again.'
      )
    case 'unknown-project':
      return translate(`${KEY}.unknownProject`, 'Engram does not have that project any more.')
    case 'timed-out':
      return translate(
        `${KEY}.timedOut`,
        'The sync took too long. Check your connection and try again.'
      )
    case 'failed':
      return translate(
        `${KEY}.failed`,
        'The sync did not complete. Check your server address and sign-in, then try again.'
      )
  }
}

function syncState(project: EngramCloudProject): string {
  return project.lastSyncedAt === null
    ? translate(`${KEY}.notSynced`, 'Not synced')
    : translate(`${KEY}.synced`, 'Synced {{when}}', { when: relativeTimeAgo(project.lastSyncedAt) })
}

/** One row per Engram project with its sync state; shown only once a server is set. */
export function MarketplaceEngramCloud(): React.JSX.Element | null {
  const [projects, setProjects] = useState<EngramCloudProject[] | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const api = window.api?.marketplaceEngramOps
    if (!api) {
      return
    }
    void Promise.resolve()
      .then(() => api.listCloudProjects())
      .then((result) => {
        if (!live) {
          return
        }
        if (result.ok) {
          setProjects(result.projects)
        } else {
          setMessage(engramCloudFailureMessage(result.reason))
        }
      })
      .catch(() => live && setMessage(engramCloudFailureMessage('failed')))
    return () => {
      live = false
    }
  }, [])

  const sync = useCallback(async (name: string) => {
    const api = window.api?.marketplaceEngramOps
    if (!api) {
      return
    }
    setSyncing(name)
    setMessage(null)
    try {
      const result = await api.syncCloudProject({ name })
      if (result.ok) {
        const at = result.lastSyncedAt ?? Date.now()
        setProjects((current) =>
          current ? current.map((p) => (p.name === name ? { ...p, lastSyncedAt: at } : p)) : current
        )
      } else {
        setMessage(engramCloudFailureMessage(result.reason))
      }
    } catch {
      setMessage(engramCloudFailureMessage('failed'))
    } finally {
      setSyncing(null)
    }
  }, [])

  return (
    <div className="flex flex-col gap-1" data-marketplace-engram="cloud">
      <p className="text-sm font-medium">{translate(`${KEY}.title`, 'Projects in the cloud')}</p>
      {projects?.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate(`${KEY}.empty`, 'Engram has no projects on this computer yet.')}
        </p>
      ) : null}
      {projects?.map((project) => (
        <MarketplaceInfoRow key={project.name} label={project.name}>
          <span className="text-sm text-muted-foreground">{syncState(project)}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncing !== null}
            onClick={() => void sync(project.name)}
          >
            {syncing === project.name
              ? translate(`${KEY}.syncing`, 'Syncing...')
              : translate(`${KEY}.sync`, 'Sync this project')}
          </Button>
        </MarketplaceInfoRow>
      ))}
      {message ? (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  )
}
