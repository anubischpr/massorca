import React from 'react'
import { Check } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import StatusIndicator from '@/components/sidebar/StatusIndicator'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import type { RuntimeHostConnectionState } from '@/runtime/runtime-host-connection-state'
import type {
  FloatingSessionCandidate,
  FloatingSessionGroup
} from './floating-session-picker-groups'

function hostDot(state: RuntimeHostConnectionState): 'active' | 'inactive' {
  return state === 'connected' ? 'active' : 'inactive'
}

/**
 * A searchable list of sessions under "<host> · <repo / workspace>" headings. The caller chooses
 * what a pick does; a Follow focus row and a per-row trailing slot are optional.
 */
export function FloatingSessionPicker({
  open,
  onOpenChange,
  groups,
  onPick,
  followFocus,
  trailing,
  selectedTabId,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: FloatingSessionGroup[]
  onPick: (candidate: FloatingSessionCandidate) => void
  /** Present on the Checklist tab only: a row that gives the choice back to the focus. */
  followFocus?: { following: boolean; onSelect: () => void }
  /** Muted text at the end of a row, such as a checklist's progress. */
  trailing?: (candidate: FloatingSessionCandidate) => React.ReactNode
  selectedTabId?: string | null
  /** The element that opens the picker. */
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput
            placeholder={translate('components.floatingSessionPicker.search', 'Search sessions')}
          />
          <CommandList>
            <CommandEmpty>
              {translate('components.floatingSessionPicker.empty', 'No sessions found.')}
            </CommandEmpty>
            {followFocus ? (
              <>
                <CommandGroup>
                  <CommandItem
                    value="follow-focus"
                    onSelect={() => {
                      followFocus.onSelect()
                      onOpenChange(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {translate('components.floatingSessionPicker.followFocus', 'Follow focus')}
                    </span>
                    {followFocus.following ? <Check aria-hidden className="size-3.5" /> : null}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}
            {groups.map((group) => {
              const heading = `${group.hostLabel} · ${group.heading}`
              return (
                <CommandGroup
                  key={group.worktreeId}
                  heading={
                    <span className="flex min-w-0 items-center gap-1.5">
                      <StatusIndicator status={hostDot(group.hostState)} showTooltip={false} />
                      <span className="truncate">{heading}</span>
                    </span>
                  }
                >
                  {group.candidates.map((candidate) => (
                    <CommandItem
                      key={candidate.tabId}
                      value={`${heading} ${candidate.label} ${candidate.tabId}`}
                      onSelect={() => {
                        onPick(candidate)
                        onOpenChange(false)
                      }}
                    >
                      <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                        <AgentIcon agent={agentTypeToIconAgent(candidate.agent)} size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{candidate.label}</span>
                      {trailing ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {trailing(candidate)}
                        </span>
                      ) : null}
                      {candidate.tabId === selectedTabId ? (
                        <Check aria-hidden className="size-3.5" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
