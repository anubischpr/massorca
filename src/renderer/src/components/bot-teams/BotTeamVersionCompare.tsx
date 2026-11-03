import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronUp, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { formatByteSize } from '@/components/artifacts/artifact-display-labels'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { readBotTeamVersionFile } from '@/runtime/runtime-bot-team-client'
import {
  compareBotTeamTexts,
  type BotTeamCompareRow
} from '../../../../shared/bot-team-version-compare'
import type {
  BotTeamVersion,
  BotTeamVersionFile
} from '../../../../shared/rpc-contract/bot-team-version-params'
import { BotTeamFilesBar } from './BotTeamFilesBar'
import { botTeamVersionLabel, botTeamVersionMeta } from './bot-team-version-labels'

const NUMBER_WORDS = ['One', 'Two', 'Three']

function changesLabel(total: number): string {
  if (total === 0) {
    return translate('components.botTeams.noChanges', 'No changes')
  }
  if (total === 1) {
    return translate('components.botTeams.oneChange', 'One change')
  }
  return translate('components.botTeams.manyChanges', '{{amount}} changes', {
    amount: NUMBER_WORDS[total - 1] ?? String(total)
  })
}

function CompareCell({
  text,
  kind,
  badge,
  focused
}: {
  text: string | null
  kind: 'add' | 'rem' | 'chg' | null
  badge: string | null
  focused: boolean
}): React.JSX.Element {
  const tone =
    kind === 'add'
      ? 'border-transparent bg-[var(--diff-added-ground)]'
      : kind === 'rem'
        ? 'border-transparent bg-[var(--diff-removed-ground)]'
        : kind === 'chg'
          ? 'border-transparent bg-[color:color-mix(in_srgb,var(--git-decoration-modified)_12%,transparent)]'
          : 'bg-card'
  return (
    <div
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm leading-normal',
        text === null ? 'border-dashed bg-transparent' : ['border-border', tone],
        focused && 'ring-2 ring-ring'
      )}
    >
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{text}</span>
      {badge ? (
        <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-secondary px-2 text-xs font-medium">
          {badge}
        </span>
      ) : null}
    </div>
  )
}

function rowBadges(row: BotTeamCompareRow): { left: string | null; right: string | null } {
  const added = translate('components.botTeams.changeAdded', 'Added')
  const removed = translate('components.botTeams.changeRemoved', 'Removed')
  const changed = translate('components.botTeams.changeChanged', 'Changed')
  return {
    left: row.change === 'added' ? added : row.change === 'changed' ? changed : null,
    right: row.change === 'removed' ? removed : row.change === 'changed' ? changed : null
  }
}

/** Binary and large versions cannot be read line by line, so they say what they are instead. */
function notComparedText(file: BotTeamVersionFile): string {
  if (file.kind === 'binary' && file.size !== undefined) {
    return translate(
      'components.botTeams.binaryVersion',
      'Binary file. This version is {{size}}.',
      {
        size: formatByteSize(file.size)
      }
    )
  }
  if (file.kind === 'too-large' && file.size !== undefined) {
    return translate(
      'components.botTeams.tooLargeVersion',
      'Too large to compare here. This version is {{size}}.',
      { size: formatByteSize(file.size) }
    )
  }
  return translate('components.botTeams.cannotCompare', 'This version can’t be compared here.')
}

/** The file as it is now beside an earlier version, with the differences marked. */
export function BotTeamVersionCompare({
  teamId,
  relativePath,
  currentText,
  versions,
  index,
  onIndex,
  onBack,
  onRestore
}: {
  teamId: string
  relativePath: string
  currentText: string
  /** The earlier versions this file can be compared with, newest first. */
  versions: BotTeamVersion[]
  index: number
  onIndex: (index: number) => void
  onBack: () => void
  onRestore: (version: BotTeamVersion) => void
}): React.JSX.Element {
  const version = versions[index]
  const [earlier, setEarlier] = useState<BotTeamVersionFile | null>(null)
  const [only, setOnly] = useState(false)
  const [position, setPosition] = useState(0)
  const focusRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    let closed = false
    setEarlier(null)
    setPosition(0)
    void readBotTeamVersionFile(teamId, version.id, relativePath).then(
      (file) => {
        if (!closed && file !== 'unavailable') {
          setEarlier(file)
        }
      },
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [teamId, version.id, relativePath])
  const compared = useMemo(
    () => (earlier?.kind === 'text' ? compareBotTeamTexts(currentText, earlier.text) : null),
    [currentText, earlier]
  )
  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [position, compared])
  const total = compared?.changes ?? 0
  const rows = compared ? compared.rows.filter((row) => !only || row.change !== null) : []
  const step = (by: number): void => setPosition((current) => (current + by + total) % total)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamFilesBar>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate('components.botTeams.backToVersions', 'Back to versions')}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-0 truncate">{relativePath}</span>
        <span className="font-normal text-muted-foreground">
          {translate('components.botTeams.compare', 'Compare')}
        </span>
      </BotTeamFilesBar>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-sm">
        <span className="font-medium">{changesLabel(total)}</span>
        {total > 0 ? (
          <span className="text-xs text-muted-foreground">
            {translate('components.botTeams.changePosition', 'Change {{position}} of {{total}}', {
              position: NUMBER_WORDS[position]?.toLowerCase() ?? String(position + 1),
              total: NUMBER_WORDS[total - 1]?.toLowerCase() ?? String(total)
            })}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={total === 0}
          aria-label={translate('components.botTeams.previousChange', 'Previous change')}
          onClick={() => step(-1)}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={total === 0}
          aria-label={translate('components.botTeams.nextChange', 'Next change')}
          onClick={() => step(1)}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          variant={only ? 'secondary' : 'outline'}
          size="xs"
          className="rounded-full"
          onClick={() => setOnly(!only)}
        >
          {translate('components.botTeams.showOnlyChanges', 'Show only changes')}
        </Button>
        <span className="flex-1" />
        <Button onClick={() => onRestore(version)}>
          <RotateCcw className="size-3.5" />
          {translate('components.botTeams.restoreThisVersion', 'Restore this version')}
        </Button>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-3 px-4 pb-2 pt-3 text-[13px] font-medium">
        <div className="flex h-7 items-center">
          {translate('components.botTeams.current', 'Current')}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={versions.length < 2}
          onClick={() => onIndex((index + 1) % versions.length)}
        >
          {`${botTeamVersionLabel(version)}, ${botTeamVersionMeta(version)}`}
          <ChevronDown className="size-3" />
        </Button>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto pb-4">
        {earlier !== null && earlier.kind !== 'text' ? (
          <p className="px-4 text-sm text-muted-foreground">{notComparedText(earlier)}</p>
        ) : null}
        {rows.map((row, at) => {
          const focused = row.index === position && row.change !== null
          const badges = rowBadges(row)
          const kind = row.change === 'added' ? 'add' : row.change === 'removed' ? 'rem' : 'chg'
          const shown = row.change === null ? null : kind
          return (
            <div
              key={at}
              ref={focused ? focusRef : undefined}
              className="grid grid-cols-2 gap-3 px-4 pb-2"
            >
              <CompareCell
                text={row.left}
                kind={row.change === 'removed' ? null : shown}
                badge={badges.left}
                focused={focused}
              />
              <CompareCell
                text={row.right}
                kind={row.change === 'added' ? null : shown}
                badge={badges.right}
                focused={focused}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
