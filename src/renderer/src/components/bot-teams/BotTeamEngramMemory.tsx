import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { listBotTeamEngramMemory } from '@/runtime/runtime-bot-team-engram-client'
import { listBotTeamRoom } from '@/runtime/runtime-bot-team-project-client'
import type { BotTeamEngramReply } from '../../../../shared/rpc-contract/bot-team-engram-params'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'

function statusLine(reply: BotTeamEngramReply, searched: boolean): string | null {
  if (reply.status === 'unavailable') {
    return translate(
      'components.botTeams.engramUnavailable',
      'Engram is not available on this host.'
    )
  }
  if (reply.status === 'failed') {
    return translate('components.botTeams.engramFailed', 'Could not read Engram. Try again.')
  }
  if (reply.memories.length === 0) {
    return searched
      ? translate('components.botTeams.engramNoMatch', 'No Engram memories match that search.')
      : translate('components.botTeams.engramEmpty', 'No Engram memories for {{name}} yet.', {
          name: reply.projectName ?? ''
        })
  }
  return null
}

/** The linked Workspaces project's Engram memories, read-only: the latest few, or a search. */
export function BotTeamEngramMemory({ team }: { team: BotTeam }): React.JSX.Element | null {
  const [projects, setProjects] = useState<BotTeamProject[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [reply, setReply] = useState<BotTeamEngramReply | null>(null)

  useEffect(() => {
    if (!team.workspacesEnabled) {
      return
    }
    let closed = false
    void listBotTeamRoom(team.id).then(
      (room) => {
        const linked = (room.projects ?? []).filter((project) => project.workspace)
        if (!closed) {
          setProjects(linked)
          setProjectId((current) => current ?? linked[0]?.id ?? null)
        }
      },
      () => undefined
    )
    return () => {
      closed = true
    }
  }, [team.id, team.workspacesEnabled])

  useEffect(() => {
    if (!projectId) {
      return
    }
    let closed = false
    setReply(null)
    void listBotTeamEngramMemory({
      teamId: team.id,
      projectId,
      ...(query ? { query } : {})
    }).then(
      (next) => !closed && setReply(next),
      () => !closed && setReply({ status: 'failed', memories: [] })
    )
    return () => {
      closed = true
    }
  }, [team.id, projectId, query])

  if (!team.workspacesEnabled || projects.length === 0) {
    return null
  }
  const line = reply ? statusLine(reply, query !== '') : null
  return (
    <div className="flex flex-col gap-3" data-testid="bot-team-engram-memory">
      <div>
        <h2 className="text-lg font-semibold">
          {translate('components.botTeams.engramTitle', 'Engram')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {translate(
            'components.botTeams.engramHelp',
            'Memories Engram keeps for this project. You can read them here, not change them.'
          )}
        </p>
      </div>
      {projects.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {projects.map((project) => (
            <Button
              key={project.id}
              variant={project.id === projectId ? 'secondary' : 'outline'}
              size="xs"
              className="rounded-full"
              onClick={() => {
                setProjectId(project.id)
                setDraft('')
                setQuery('')
              }}
            >
              {project.name}
            </Button>
          ))}
        </div>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(draft.trim())
        }}
      >
        <Input
          value={draft}
          maxLength={200}
          placeholder={translate('components.botTeams.engramSearch', 'Search Engram memories')}
          aria-label={translate('components.botTeams.engramSearch', 'Search Engram memories')}
          onChange={(event) => {
            setDraft(event.target.value)
            if (event.target.value.trim() === '') {
              setQuery('')
            }
          }}
        />
        <Button type="submit" variant="outline" size="sm">
          <Search className="size-3.5" />
          {translate('components.botTeams.engramSearchButton', 'Search')}
        </Button>
      </form>
      {reply ? (
        <div className="flex flex-col rounded-xl border border-border bg-card">
          {reply.status === 'ok'
            ? reply.memories.map((memory) => (
                <div key={memory.id} className="border-t border-border px-4 py-3 first:border-t-0">
                  <div className="text-sm font-medium">
                    {memory.title}
                    {memory.type ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {memory.type}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{memory.excerpt}</div>
                </div>
              ))
            : null}
          {line ? <div className="px-4 py-3 text-sm text-muted-foreground">{line}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
