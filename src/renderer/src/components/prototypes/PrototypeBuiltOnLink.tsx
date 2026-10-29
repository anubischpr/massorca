import { translate } from '@/i18n/i18n'

/** The set header's link to the design system its request was built on: opens that project's view. */
export function PrototypeBuiltOnLink({
  version,
  onOpen
}: {
  version: number
  onOpen: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="truncate text-left text-xs text-muted-foreground hover:text-foreground"
    >
      {translate(
        'components.prototypes.designSystem.builtOnLink',
        'Built on Design system v{{version}} ›',
        {
          version
        }
      )}
    </button>
  )
}
