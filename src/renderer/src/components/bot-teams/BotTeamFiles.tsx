import { createElement, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { listBotTeamFiles } from '@/runtime/runtime-bot-team-client'
import { listBotTeamProjectFiles } from '@/runtime/runtime-bot-team-client-project-files'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamProjectFile,
  BotTeamProjectFiles
} from '../../../../shared/rpc-contract/bot-team-files-project-params'
import type { RuntimeFileListEntry } from '../../../../shared/runtime-file-contracts'
import { BotTeamFilePreview } from './BotTeamFilePreview'
import { BotTeamFilesBar } from './BotTeamFilesBar'
import { BotTeamFileVersions } from './BotTeamFileVersions'
import { unseenBotTeamFiles, useBotTeamSeenFilesStore } from './bot-team-file-read-state'
import { botTeamFileKey, listedBotTeamFileKeys, readBotTeamFileText } from './bot-team-file-source'
import { isBotTeamFileVisible } from './bot-team-file-visibility'
import { botTeamFileChangeMeta } from './bot-team-version-labels'
import { useBotTeamVersions } from './use-bot-team-versions'

/** The file a row opened: in the team's folder, or in a linked project's workspace. */
type OpenFileTarget = {
  relativePath: string
  kind: 'text' | 'binary'
  workspaceId: string | null
}

type ProjectSection = BotTeamProjectFiles['projects'][number]

/** A file of the team, shown as it is: nobody edits it from here, so it never competes with a bot. */
function OpenFile({
  teamId,
  file,
  onBack
}: {
  teamId: string
  file: OpenFileTarget
  onBack: () => void
}): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  useEffect(() => {
    if (file.kind === 'binary') {
      return
    }
    let closed = false
    void readBotTeamFileText({
      teamId,
      relativePath: file.relativePath,
      workspaceId: file.workspaceId
    }).then(
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
  }, [teamId, file.relativePath, file.kind, file.workspaceId])
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
        <BotTeamFilePreview
          teamId={teamId}
          relativePath={file.relativePath}
          workspaceId={file.workspaceId}
          kind={file.kind}
          text={content}
        />
      </div>
    </div>
  )
}

/** One file a Files list names; a dot marks a file a bot made that the person has not opened. */
function FileRow({
  relativePath,
  meta,
  unread,
  onOpen
}: {
  relativePath: string
  meta: string | null
  unread: boolean
  onOpen: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm font-medium first:border-t-0 hover:bg-muted"
    >
      {createElement(getFileTypeIcon(relativePath), {
        className: 'size-4 shrink-0 text-muted-foreground'
      })}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{relativePath}</span>
        {meta ? (
          <span className="block truncate text-xs font-normal text-muted-foreground">{meta}</span>
        ) : null}
      </span>
      {unread ? (
        <span
          role="img"
          aria-label={translate('components.botTeams.newFile', 'New file')}
          className="size-2 shrink-0 rounded-full bg-primary"
        />
      ) : null}
    </button>
  )
}

/** Files: what the team's bots and the person put in the team folder, and what its tasks changed in linked projects. */
export function BotTeamFiles({
  team,
  openPath
}: {
  team: BotTeam
  /** A file to open once the list arrives, such as a file attached in the room. */
  openPath?: string
}): React.JSX.Element {
  const [files, setFiles] = useState<RuntimeFileListEntry[] | null>(null)
  const [projects, setProjects] = useState<ProjectSection[]>([])
  const [open, setOpen] = useState<OpenFileTarget | null>(null)
  const versions = useBotTeamVersions(team.id)
  const seen = useBotTeamSeenFilesStore((state) => state.seen[team.id])
  const seedTeam = useBotTeamSeenFilesStore((state) => state.seedTeam)
  const markSeen = useBotTeamSeenFilesStore((state) => state.markSeen)
  useEffect(() => {
    let closed = false
    void Promise.all([
      listBotTeamFiles(team.id),
      // A host from before linked project files has none to show, and nothing to report.
      listBotTeamProjectFiles(team.id).catch((): 'unavailable' => 'unavailable')
    ]).then(
      ([listed, linked]) => {
        if (closed) {
          return
        }
        const found = (listed === 'unavailable' ? [] : listed.files).filter((file) =>
          isBotTeamFileVisible(file.relativePath)
        )
        const sections = (linked === 'unavailable' ? [] : linked.projects)
          .map((section) => ({
            ...section,
            files: section.files.filter((file) => isBotTeamFileVisible(file.relativePath))
          }))
          .filter((section) => section.files.length > 0)
        // Why: what is listed on first sight counts as seen, so only files that arrive later are new.
        seedTeam(
          team.id,
          listedBotTeamFileKeys(
            found.map((file) => file.relativePath),
            sections.flatMap((section) => section.files)
          )
        )
        const match = found.find((file) => file.relativePath === openPath) ?? null
        if (match) {
          markSeen(team.id, botTeamFileKey({ relativePath: match.relativePath, workspaceId: null }))
        }
        setFiles(found)
        setProjects(sections)
        setOpen(
          match ? { relativePath: match.relativePath, kind: match.kind, workspaceId: null } : null
        )
      },
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [team.id, openPath, seedTeam, markSeen])
  const keptState =
    versions.state !== null && versions.state !== 'unavailable' && versions.state.git === 'ok'
      ? versions.state
      : null
  const kept = keptState !== null
  const saved = keptState !== null && keptState.versions.length > 0
  const unread = new Set(
    unseenBotTeamFiles(
      listedBotTeamFileKeys(
        (files ?? []).map((file) => file.relativePath),
        projects.flatMap((section) => section.files)
      ),
      seen
    )
  )
  const openTeamFile = (file: RuntimeFileListEntry): void => {
    markSeen(team.id, botTeamFileKey({ relativePath: file.relativePath, workspaceId: null }))
    setOpen({ relativePath: file.relativePath, kind: file.kind, workspaceId: null })
  }
  const openProjectFile = (file: BotTeamProjectFile): void => {
    markSeen(team.id, botTeamFileKey(file))
    setOpen({ relativePath: file.relativePath, kind: file.kind, workspaceId: file.workspaceId })
  }
  if (open) {
    // Why: versions are kept for the team's folder only; a project file opens where it is.
    return kept && open.workspaceId === null ? (
      <BotTeamFileVersions
        teamId={team.id}
        relativePath={open.relativePath}
        binary={open.kind === 'binary'}
        onBack={() => setOpen(null)}
        onRestored={versions.reload}
      />
    ) : (
      <OpenFile teamId={team.id} file={open} onBack={() => setOpen(null)} />
    )
  }
  const empty = files !== null && files.length === 0 && projects.length === 0
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamFilesBar>{translate('components.botTeams.files', 'Files')}</BotTeamFilesBar>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          {files && files.length > 0 ? (
            <div className="flex flex-col rounded-xl border border-border bg-card">
              {files.map((file) => {
                const lastId = keptState?.lastVersionOfFile[file.relativePath]
                const last = keptState?.versions.find((v) => v.id === lastId)
                const meta = last ? botTeamFileChangeMeta(last) : null
                return (
                  <FileRow
                    key={file.relativePath}
                    relativePath={file.relativePath}
                    meta={meta}
                    unread={unread.has(
                      botTeamFileKey({ relativePath: file.relativePath, workspaceId: null })
                    )}
                    onOpen={() => openTeamFile(file)}
                  />
                )
              })}
            </div>
          ) : null}
          {projects.map((section) => (
            <section key={section.projectId} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground">{section.name}</h2>
              <div className="flex flex-col rounded-xl border border-border bg-card">
                {section.files.map((file) => (
                  <FileRow
                    key={botTeamFileKey(file)}
                    relativePath={file.relativePath}
                    meta={null}
                    unread={unread.has(botTeamFileKey(file))}
                    onOpen={() => openProjectFile(file)}
                  />
                ))}
              </div>
            </section>
          ))}
          {empty ? (
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
