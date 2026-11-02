import { Globe, FileText, Plus, Smartphone, Terminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShortcutLabel } from '../../hooks/useShortcutLabel'
import type { SidePanelNewTabKind, SidePanelNewTabOption } from './side-panel-new-tab-options'

export function SidePanelKindIcon({ kind }: { kind: SidePanelNewTabKind }): React.JSX.Element {
  if (kind === 'new-terminal') {
    return <Terminal />
  }
  if (kind === 'new-browser') {
    return <Globe />
  }
  return kind === 'new-markdown' ? <FileText /> : <Smartphone />
}

/** The + menu: exactly the four creatable kinds, with the shortcuts that exist for them. */
export function SidePanelNewTabMenu({
  options,
  onCreate
}: {
  options: readonly SidePanelNewTabOption[]
  onCreate: (kind: SidePanelNewTabKind) => void
}): React.JSX.Element {
  const terminalShortcut = useShortcutLabel('tab.newTerminal')
  const browserShortcut = useShortcutLabel('tab.newBrowser')
  const label = translate('components.side-panel.new-tab', 'New tab')
  const shortcutFor = (kind: SidePanelNewTabKind): string | null =>
    kind === 'new-terminal' ? terminalShortcut : kind === 'new-browser' ? browserShortcut : null
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={label}>
              <Plus />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        {options.map((option) => {
          const shortcut = shortcutFor(option.kind)
          return (
            <DropdownMenuItem key={option.kind} onSelect={() => onCreate(option.kind)}>
              <SidePanelKindIcon kind={option.kind} />
              {option.label}
              {shortcut ? <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
