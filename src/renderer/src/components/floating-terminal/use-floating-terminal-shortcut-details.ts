import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'

export function useFloatingTerminalShortcutDetails() {
  const newTerminalShortcut = useShortcutKeyDetails('tab.newTerminal')
  const newBrowserShortcut = useShortcutKeyDetails('tab.newBrowser')
  const newMarkdownShortcut = useShortcutKeyDetails('tab.newMarkdown')
  const openMarkdownShortcut = useShortcutKeyDetails('tab.openMarkdown')
  const closeShortcut = useShortcutKeyDetails('tab.close')
  const newChecklistShortcut = useShortcutKeyDetails('tab.newChecklist')
  const openSessionShortcut = useShortcutKeyDetails('tab.openSession')

  return {
    newTerminalShortcut,
    newBrowserShortcut,
    newMarkdownShortcut,
    openMarkdownShortcut,
    newChecklistShortcut,
    openSessionShortcut,
    closeShortcut
  }
}
