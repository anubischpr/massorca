import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { listBotTeamFiles, readBotTeamFile } from '@/runtime/runtime-bot-team-client'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { RuntimeFileListEntry } from '../../../../shared/runtime-file-contracts'

function FilesBar({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium">
      {children}
    </div>
  )
}

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
      <FilesBar>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate('components.botTeams.backToFiles', 'Back to files')}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-0 truncate">{file.relativePath}</span>
      </FilesBar>
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
  if (open) {
    return <OpenFile teamId={team.id} file={open} onBack={() => setOpen(null)} />
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilesBar>{translate('components.botTeams.files', 'Files')}</FilesBar>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          {files && files.length > 0 ? (
            <div className="flex flex-col rounded-xl border border-border bg-card">
              {files.map((file) => {
                const FileIcon = getFileTypeIcon(file.relativePath)
                return (
                  <button
                    key={file.relativePath}
                    type="button"
                    disabled={file.kind === 'binary'}
                    onClick={() => setOpen(file)}
                    className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm font-medium first:border-t-0 hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.relativePath}</span>
                  </button>
                )
              })}
            </div>
          ) : files ? (
            <p className="text-sm text-muted-foreground">
              {translate('components.botTeams.nothingHere', 'Nothing here yet.')}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.filesHelp',
              'One bot or person edits a file at a time. Every change is saved as a version.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
