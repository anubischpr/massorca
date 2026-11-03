import { useState } from 'react'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { setBotTeamProjectBrief } from '@/runtime/runtime-bot-team-client'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamBrief } from '../../../../shared/rpc-contract/bot-team-room-params'
import { briefEditorMarkdown } from '../../../../shared/bot-team-project-brief-markdown'
import { BotTeamProjectBriefEditor } from './BotTeamProjectBriefEditor'
import { BotTeamViewHeader } from './BotTeamViewHeader'
import { useTeamWork } from './use-bot-team-work'

export type BotTeamProjectTab = 'board' | 'brief'

/** Board and Brief, side by side in the bar of a project. */
export function BotTeamProjectTabs({
  value,
  onChange
}: {
  value: BotTeamProjectTab
  onChange: (tab: BotTeamProjectTab) => void
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => {
        if (next === 'board' || next === 'brief') {
          onChange(next)
        }
      }}
    >
      <ToggleGroupItem value="board">
        {translate('components.botTeams.board', 'Board')}
      </ToggleGroupItem>
      <ToggleGroupItem value="brief">
        {translate('components.botTeams.brief', 'Brief')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

const linesOf = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

/** A short line of the brief, the Goal. Pressing it opens the text; leaving it saves. */
function BriefSection({
  label,
  lines,
  onSave
}: {
  label: string
  lines: string[]
  onSave: (lines: string[]) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <>
      <h2 className="text-sm font-semibold">{label}</h2>
      {draft === null ? (
        <button
          type="button"
          aria-label={label}
          onClick={() => setDraft(lines.join('\n'))}
          className="flex w-full cursor-text flex-col rounded-xl border border-border bg-card text-left"
        >
          {lines.map((line, index) => (
            <span
              key={`${index}:${line}`}
              className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm first:border-t-0"
            >
              <span className="min-w-0 flex-1 whitespace-pre-wrap">{line}</span>
            </span>
          ))}
        </button>
      ) : (
        <Textarea
          autoFocus
          aria-label={label}
          rows={Math.max(3, draft.split('\n').length + 1)}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = linesOf(draft)
            setDraft(null)
            if (next.join('\n') !== lines.join('\n')) {
              onSave(next)
            }
          }}
        />
      )}
    </>
  )
}

/** What a project holds: the why. Each task holds the how, and its bots read this first. */
export function BotTeamProjectBrief({
  team,
  projectId,
  onBack,
  onTab
}: {
  team: BotTeam
  projectId: string
  onBack: () => void
  onTab: (tab: BotTeamProjectTab) => void
}): React.JSX.Element {
  const [refresh, setRefresh] = useState(0)
  const { projects } = useTeamWork(team.id, String(refresh))
  const project = projects.find((entry) => entry.id === projectId)
  const save = async (patch: Partial<BotTeamBrief> & { goal?: string }): Promise<boolean> => {
    if (!project) {
      return false
    }
    const { goal, ...briefPatch } = patch
    try {
      const done = await setBotTeamProjectBrief(project.id, {
        goal: goal ?? project.goal,
        brief: { ...project.brief, ...briefPatch }
      })
      if (done === 'unavailable') {
        toast.error(
          translate(
            'components.botTeams.hostCannotKeepBrief',
            'This host cannot keep a project brief yet.'
          )
        )
        return false
      }
      setRefresh((current) => current + 1)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return false
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamViewHeader
        title={project?.name ?? ''}
        detail={team.name}
        backLabel={translate('components.botTeams.board', 'Board')}
        onBack={onBack}
        trailing={<BotTeamProjectTabs value="brief" onChange={onTab} />}
      />
      <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto">
        {project ? (
          // Why: the column fills the page so the editor box grows to the window, with a 60vh floor.
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[736px] flex-col gap-5 px-4 py-8">
            <div>
              <h1 className="text-xl font-semibold">
                {translate('components.botTeams.brief', 'Brief')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {translate(
                  'components.botTeams.briefHelp',
                  'The project holds the why. Each task holds the how. Bots read this brief and their own task thread.'
                )}
              </p>
            </div>
            <BriefSection
              label={translate('components.botTeams.briefGoal', 'Goal')}
              lines={project.goal ? [project.goal] : []}
              onSave={(lines) => void save({ goal: lines.join(' ') })}
            />
            <BotTeamProjectBriefEditor
              key={project.id}
              projectId={project.id}
              markdown={briefEditorMarkdown(project.brief)}
              onSave={(markdown) => save({ markdown })}
            />
            {project.briefUpdatedAt !== null ? (
              <p className="text-xs text-muted-foreground">
                {translate('components.botTeams.briefUpdated', 'Updated {{time}} by you.', {
                  time: new Date(project.briefUpdatedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
