/** The bar over a Files screen. */
export function BotTeamFilesBar({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium">
      {children}
    </div>
  )
}
