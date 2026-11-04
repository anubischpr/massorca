/** One titled section of an app page; its id is what the page order and tests read. */
export function MarketplaceAppSection({
  id,
  title,
  action,
  children
}: {
  id: string
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const headingId = `marketplace-app-${id}-heading`
  return (
    <section
      data-marketplace-section={id}
      aria-labelledby={headingId}
      className="flex flex-col gap-3"
    >
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h3 id={headingId} className="text-sm font-semibold">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}
