import { useState } from 'react'
import { parseNumberInput, type NumberBounds } from '../../../../shared/prototype-number-input'

/**
 * A number Edit field. A number typed in range is committed as typed; a number past its range is
 * committed at the bound it is pinned to and shown as that bound. A blank or partial entry commits
 * nothing and stays as typed until blur, which shows the committed value again.
 */
export function PrototypeNumberField({
  value,
  bounds,
  onCommit,
  className,
  ariaLabel
}: {
  value: number
  bounds: NumberBounds
  onCommit: (value: number) => void
  className?: string
  ariaLabel?: string
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      className={className}
      value={draft ?? String(value)}
      onChange={(event) => {
        const text = event.target.value
        const next = parseNumberInput(text, bounds)
        if (next === null) {
          setDraft(text)
          return
        }
        setDraft(next === Number(text) ? text : String(next))
        onCommit(next)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
