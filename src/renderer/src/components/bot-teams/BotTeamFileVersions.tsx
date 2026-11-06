import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  listBotTeamFileVersions,
  readBotTeamFile,
  readBotTeamVersionFile,
  restoreBotTeamFileVersion
} from '@/runtime/runtime-bot-team-client'
import type {
  BotTeamFileVersion,
  BotTeamVersion
} from '../../../../shared/rpc-contract/bot-team-version-params'
import { BotTeamFilePreview } from './BotTeamFilePreview'
import { BotTeamFilesBar } from './BotTeamFilesBar'
import { VersionHistoryList } from '../version-history/VersionHistoryList'
import { BotTeamRestoreDialog } from './BotTeamRestoreDialog'
import { BotTeamVersionCompare } from './BotTeamVersionCompare'
import { botTeamVersionLabel, botTeamVersionMeta } from './bot-team-version-labels'

function failure(error: unknown): void {
  toast.error(error instanceof Error ? error.message : String(error))
}

/** A file with its versions: how it reads now, and each earlier version to compare or restore. */
export function BotTeamFileVersions({
  teamId,
  relativePath,
  binary = false,
  onBack,
  onRestored
}: {
  teamId: string
  relativePath: string
  /** A binary file: its preview replaces the text, and its versions cannot be compared as text. */
  binary?: boolean
  onBack: () => void
  onRestored: () => void
}): React.JSX.Element {
  const [current, setCurrent] = useState<string | null>(null)
  const [entries, setEntries] = useState<BotTeamFileVersion[] | null>(null)
  const [newestMatches, setNewestMatches] = useState(false)
  const [comparing, setComparing] = useState<number | null>(null)
  const [restoring, setRestoring] = useState<BotTeamVersion | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    const [read, listed] = await Promise.all([
      binary ? null : readBotTeamFile(teamId, relativePath),
      listBotTeamFileVersions(teamId, relativePath)
    ])
    // A binary file has no text: the viewer shows its preview instead.
    const text = read === null || read === 'unavailable' ? null : read.content
    const versions = listed === 'unavailable' ? [] : listed
    const newest = versions[0]
    // The newest version is the file as it stands only when nothing changed since it was saved.
    const matches =
      text !== null &&
      newest !== undefined &&
      !newest.deleted &&
      (await readBotTeamVersionFile(teamId, newest.version.id, relativePath).then(
        (file) => file !== 'unavailable' && file.kind === 'text' && file.text === text,
        () => false
      ))
    setCurrent(text)
    setEntries(versions)
    setNewestMatches(matches)
  }, [teamId, relativePath, binary])

  useEffect(() => {
    void load().catch(failure)
  }, [load])

  const earlier = (entries ?? [])
    .slice(newestMatches ? 1 : 0)
    .filter((entry) => !entry.deleted)
    .map((entry) => entry.version)
  const newest = newestMatches ? entries?.[0]?.version : undefined

  const restore = async (version: BotTeamVersion): Promise<void> => {
    setBusy(true)
    try {
      const result = await restoreBotTeamFileVersion(teamId, version.id, relativePath)
      if (result !== 'unavailable' && !result.ok) {
        toast.error(result.message)
        return
      }
      setRestoring(null)
      setComparing(null)
      toast(translate('components.botTeams.versionRestoredToast', 'Version restored'))
      await load()
      onRestored()
    } catch (error) {
      failure(error)
    } finally {
      setBusy(false)
    }
  }

  const dialog = restoring ? (
    <BotTeamRestoreDialog
      busy={busy}
      onCancel={() => setRestoring(null)}
      onRestore={() => void restore(restoring)}
    />
  ) : null

  if (comparing !== null && current !== null && earlier[comparing]) {
    return (
      <>
        <BotTeamVersionCompare
          teamId={teamId}
          relativePath={relativePath}
          currentText={current}
          versions={earlier}
          index={comparing}
          onIndex={setComparing}
          onBack={() => setComparing(null)}
          onRestore={setRestoring}
        />
        {dialog}
      </>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamFilesBar>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate('components.botTeams.backToFiles', 'Back to files')}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-0 truncate">{relativePath}</span>
      </BotTeamFilesBar>
      <div className="flex min-h-0 flex-1 gap-5 p-5">
        <div className="scrollbar-sleek flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <BotTeamFilePreview
            teamId={teamId}
            relativePath={relativePath}
            kind={binary ? 'binary' : 'text'}
            text={current}
          />
        </div>
        <div className="w-[360px] shrink-0">
          <h2 className="mb-2 text-sm font-semibold">
            {translate('components.botTeams.versions', 'Versions')}
          </h2>
          <VersionHistoryList
            items={[
              {
                key: 'current',
                label: translate('components.botTeams.current', 'Current'),
                meta: newest ? botTeamVersionMeta(newest) : undefined
              },
              ...earlier.map((version, index) => ({
                key: version.id,
                label: botTeamVersionLabel(version),
                meta: botTeamVersionMeta(version),
                actions: (
                  <>
                    {binary ? null : (
                      <Button variant="outline" size="xs" onClick={() => setComparing(index)}>
                        {translate('components.botTeams.compare', 'Compare')}
                      </Button>
                    )}
                    <Button variant="outline" size="xs" onClick={() => setRestoring(version)}>
                      <RotateCcw className="size-3" />
                      {translate('components.botTeams.restore', 'Restore')}
                    </Button>
                  </>
                )
              }))
            ]}
          />
        </div>
      </div>
      {dialog}
    </div>
  )
}
