/** The part of a page a why line stands in for; the render test checks that each missing part has one. */
export type MarketplaceNotePart =
  | 'install'
  | 'uninstall'
  | 'access'
  | 'banner'
  | 'connection'
  | 'advanced'

/** A short line where a page's function cannot exist, saying why. A missing function is never silent. */
export function MarketplaceFunctionNote({
  part,
  label,
  children
}: {
  part: MarketplaceNotePart
  /** A visible name for the line, such as "Who can use it". */
  label?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div data-marketplace-note={part} className="flex flex-col gap-1">
      {label ? <span className="text-sm font-medium">{label}</span> : null}
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
