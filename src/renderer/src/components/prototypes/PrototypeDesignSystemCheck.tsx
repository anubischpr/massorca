import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type { PrototypeDesignSystemReadability } from '../../../../shared/prototype-design-system-readability'

/** Whether MassOrca reads the current design system, with each reason it does not or warns: the CLI check's verdict. */
export function PrototypeDesignSystemCheck({
  verdict
}: {
  verdict: PrototypeDesignSystemReadability
}): React.JSX.Element {
  const label = translate('components.prototypes.designSystem.checkLabel', 'Design system check')
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col gap-1 border-b border-border bg-sidebar px-4 py-2.5"
    >
      <div className="flex items-center gap-2">
        <Badge variant={verdict.readable ? 'secondary' : 'destructive'}>
          {verdict.readable
            ? translate('components.prototypes.designSystem.checkValid', 'Valid')
            : translate('components.prototypes.designSystem.checkInvalid', 'Not readable')}
        </Badge>
        {verdict.reasons.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {translate(
              'components.prototypes.designSystem.checkAllRead',
              'MassOrca reads tokens.json, components.html and system.md.'
            )}
          </span>
        ) : null}
      </div>
      {verdict.reasons.length === 0 ? null : (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {verdict.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
