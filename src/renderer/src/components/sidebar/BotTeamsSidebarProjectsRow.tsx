import { cn } from '@/lib/utils'

const ROW_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors'
const ROW_IDLE_CLASS = 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
const ROW_ACTIVE_CLASS = 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'

/** One row of the Bot teams sidebar. */
export function SidebarRow({
  active = false,
  indented = false,
  dimmed = false,
  onClick,
  children
}: {
  active?: boolean
  indented?: boolean
  /** An archived project: still listed, but quiet. */
  dimmed?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-bot-character-zone=""
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        ROW_CLASS,
        indented && 'pl-8',
        dimmed && 'opacity-50',
        active ? ROW_ACTIVE_CLASS : ROW_IDLE_CLASS
      )}
    >
      {children}
    </button>
  )
}

export function RowMeta({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="text-xs text-worktree-sidebar-foreground/45">{children}</span>
}
