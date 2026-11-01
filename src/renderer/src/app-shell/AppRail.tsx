import React from 'react'
import { Bot, LayoutGrid, ListChecks, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '../store'
import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { isMac } from './app-window-chrome'
import { AppRailUsage } from './AppRailUsage'

function RailButton({
  label,
  active,
  shortcut,
  onClick,
  children
}: {
  label: string
  active: boolean
  shortcut?: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          data-active={active}
          className="size-9 text-muted-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="flex items-center gap-1.5">
        {label}
        {shortcut}
      </TooltipContent>
    </Tooltip>
  )
}

const MODE_ICON_CLASS =
  'absolute inset-0 size-5 transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none'

/** Both mode icons are always mounted so a mode change crossfades them; reduced motion swaps them at once. */
function RailModeIcon({ mode }: { mode: 'workspaces' | 'bot-teams' }): React.JSX.Element {
  return (
    <span data-mode={mode} className="group/mode relative size-5">
      <LayoutGrid
        className={cn(
          MODE_ICON_CLASS,
          'group-data-[mode=bot-teams]/mode:scale-75 group-data-[mode=bot-teams]/mode:opacity-0'
        )}
      />
      <Bot
        className={cn(
          MODE_ICON_CLASS,
          'scale-75 opacity-0 group-data-[mode=bot-teams]/mode:scale-100 group-data-[mode=bot-teams]/mode:opacity-100'
        )}
      />
    </span>
  )
}

/** Always visible navigation at the far left. Bot team, Workflows, Canvas and Calendar join it when they ship. */
export function AppRail(): React.JSX.Element {
  const activeView = useAppStore((s) => s.activeView)
  const railMode = useAppStore((s) => s.railMode)
  const pressRailModeButton = useAppStore((s) => s.pressRailModeButton)
  const hintShown = useAppStore((s) => s.railWorkspacesHintShown)
  const markHintShown = useAppStore((s) => s.markRailWorkspacesHintShown)
  const openTasksHome = useAppStore((s) => s.openTasksHome)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const settingsShortcut = useShortcutKeyDetails('app.settings')
  return (
    <nav
      aria-label={translate('components.app-rail.label', 'App')}
      data-app-rail="true"
      data-mac={isMac}
      className="app-rail flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-border bg-background py-2 data-[mac=true]:pt-9"
    >
      <RailButton
        label={
          railMode === 'bot-teams'
            ? translate('components.botTeams.modeBotTeams', 'Bot teams')
            : translate('components.botTeams.modeWorkspaces', 'Workspaces')
        }
        active={
          activeView === 'terminal' || activeView === 'create-chat' || activeView === 'bot-teams'
        }
        onClick={() => {
          const outcome = pressRailModeButton()
          // Why: "again" only holds once the user has come back to Workspaces from another page.
          if (outcome === 'returned' && railMode === 'workspaces' && !hintShown) {
            markHintShown()
            toast.info(
              translate(
                'components.app-rail.workspacesAgainHint',
                'Click Workspaces again to switch to Bot teams.'
              )
            )
          }
        }}
      >
        <RailModeIcon mode={railMode} />
      </RailButton>
      <RailButton
        label={translate('components.app-rail.tasks', 'Tasks')}
        active={activeView === 'tasks'}
        onClick={openTasksHome}
      >
        <ListChecks className="size-5" />
      </RailButton>
      <div className="flex-1" />
      <AppRailUsage />
      <div className="my-1 h-px w-6 bg-border" />
      <RailButton
        label={translate('components.app-rail.settings', 'Settings')}
        active={activeView === 'settings'}
        shortcut={
          settingsShortcut.keys.length > 0 ? (
            <ShortcutKeyCombo
              keys={settingsShortcut.keys}
              doubleTap={settingsShortcut.doubleTap}
              className="gap-0.5"
              keyCapClassName="min-w-0 border-background/20 bg-background/10 px-1 py-0 text-[10px] text-background shadow-none"
              separatorClassName="text-[10px] text-background/70"
            />
          ) : null
        }
        onClick={openSettingsPage}
      >
        <Settings className="size-5" />
      </RailButton>
    </nav>
  )
}
