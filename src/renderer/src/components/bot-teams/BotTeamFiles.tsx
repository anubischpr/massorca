import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { listBotTeamFiles, readBotTeamFile } from '@/runtime/runtime-bot-team-client'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { RuntimeFileListEntry } from '../../../../shared/runtime-file-contracts'
import { BotTeamFilesBar } from './BotTeamFilesBar'
import { BotTeamFileVersions } from './BotTeamFileVersions'
import { botTeamFileChangeMeta } from './bot-team-version-labels'
import { useBotTeamVersions } from './use-bot-team-versions'

/** A file of the team, shown as it is: nobody edits it from here, so it never competes with a bot. */
function OpenFile({
  teamId,
  file,
  onBack
}: {
  teamId: string
  file: RuntimeFileListEntry
  onBack: () => void
}): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  useEffect(() => {
    let closed = false
    void readBotTeamFile(teamId, file.relativePath).then(
      (read) => {
        if (!closed && read !== 'unavailable') {
          setContent(read.content)
        }
      },
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [teamId, file.relativePath])
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
        <span className="min-w-0 truncate">{file.relativePath}</span>
      </BotTeamFilesBar>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto p-5">
        <pre className="min-h-[420px] whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-4 font-mono text-xs">
          {content}
        </pre>
      </div>
    </div>
  )
}

/** Files: what the team's bots and the person put in the team folder. */
export function BotTeamFiles({ team }: { team: BotTeam }): React.JSX.Element {
  const [files, setFiles] = useState<RuntimeFileListEntry[] | null>(null)
  const [open, setOpen] = useState<RuntimeFileListEntry | null>(null)
  const versions = useBotTeamVersions(team.id)
  useEffect(() => {
    let closed = false
    void listBotTeamFiles(team.id).then(
      (listed) => {
        // A host from before team files has none to show, and nothing to report.
        if (!closed) {
          setFiles(listed === 'unavailable' ? [] : listed.files)
        }
      },
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [team.id])
  const keptState =
    versions.state !== null && versions.state !== 'unavailable' && versions.state.git === 'ok'
      ? versions.state
      : null
  const kept = keptState !== null
  const saved = keptState !== null && keptState.versions.length > 0
  if (open) {
    return kept ? (
      <BotTeamFileVersions
        teamId={team.id}
        relativePath={open.relativePath}
        onBack={() => setOpen(null)}
        onRestored={versions.reload}
      />
    ) : (
      <OpenFile teamId={team.id} file={open} onBack={() => setOpen(null)} />
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamFilesBar>{translate('components.botTeams.files', 'Files')}</BotTeamFilesBar>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          {files && files.length > 0 ? (
            <div className="flex flex-col rounded-xl border border-border bg-card">
              {files.map((file) => {
                const FileIcon = getFileTypeIcon(file.relativePath)
                const lastId = keptState?.lastVersionOfFile[file.relativePath]
                const last = keptState?.versions.find((v) => v.id === lastId)
                const meta = last ? botTeamFileChangeMeta(last) : null
                return (
                  <button
                    key={file.relativePath}
                    type="button"
                    disabled={file.kind === 'binary'}
                    onClick={() => setOpen(file)}
                    className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm font-medium first:border-t-0 hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{file.relativePath}</span>
                      {meta ? (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {meta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : files ? (
            <p className="text-sm text-muted-foreground">
              {translate('components.botTeams.nothingHere', 'Nothing here yet.')}
            </p>
          ) : null}
          {saved ? (
            <p className="text-xs text-muted-foreground">
              {translate(
                'components.botTeams.filesHelp',
                'One bot or person edits a file at a time. Every change is saved as a version.'
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
