export function MarketplaceInfoRow({
  label,
  children
}: {
  label: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="min-w-0 text-sm">{label}</span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}
