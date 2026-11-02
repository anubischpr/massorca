import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'

const NO_PROJECT = 'none'

/** The room's question when a request names no project of a team that has projects: which one it is for. */
export function BotTeamProjectQuestion({
  projects,
  busy,
  onAnswer
}: {
  projects: readonly BotTeamProject[]
  busy: boolean
  /** The chosen project's id, or null for none. */
  onAnswer: (projectId: string | null) => void
}): React.JSX.Element {
  const baseId = useId()
  const [picked, setPicked] = useState(NO_PROJECT)
  const options = [
    { id: NO_PROJECT, name: translate('components.botTeams.noProject', 'No project') },
    ...projects.map((project) => ({ id: project.id, name: project.name }))
  ]
  return (
    <div
      role="group"
      aria-label={translate('components.botTeams.projectQuestion', 'Which project is this for?')}
      aria-busy={busy}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <p className="text-sm font-semibold text-foreground">
        {translate('components.botTeams.projectQuestion', 'Which project is this for?')}
      </p>
      <RadioGroup
        aria-label={translate('components.botTeams.projectOptions', 'The projects of this team')}
        value={picked}
        onValueChange={setPicked}
        disabled={busy}
        className="sm:grid-cols-2"
      >
        {options.map((option, index) => (
          <label
            key={option.id}
            htmlFor={`${baseId}-${index}`}
            className={cn(
              'flex min-w-0 cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
              option.id === picked
                ? 'border-primary bg-accent'
                : 'border-border hover:bg-accent/60',
              busy && 'cursor-default opacity-60'
            )}
          >
            <RadioGroupItem id={`${baseId}-${index}`} value={option.id} disabled={busy} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {option.name}
            </span>
          </label>
        ))}
      </RadioGroup>
      <div className="flex justify-end">
        <Button disabled={busy} onClick={() => onAnswer(picked === NO_PROJECT ? null : picked)}>
          {translate('components.botTeams.continue', 'Continue')}
        </Button>
      </div>
    </div>
  )
}
