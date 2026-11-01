import React from 'react'
import { LayoutGrid, ListChecks, Settings } from 'lucide-react'
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

/** Always visible navigation at the far left. Bot team, Workflows, Canvas and Calendar join it when they ship. */
export function AppRail(): React.JSX.Element {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
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
        label={translate('components.app-rail.workspaces', 'Workspaces')}
        active={activeView === 'terminal' || activeView === 'create-chat'}
        onClick={() => setActiveView('terminal')}
      >
        <LayoutGrid className="size-5" />
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
