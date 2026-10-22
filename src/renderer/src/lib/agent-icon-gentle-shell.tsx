import React from 'react'
import gentleShellUrl from '../../../shared/agent-icons/gentle-shell.png?url'

/** Gentle Shell's brand rose. Shown as-is in both themes; the PNG is already brand pink. */
export function GentleShellIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <img
      src={gentleShellUrl}
      width={size}
      height={size}
      alt=""
      aria-hidden
      style={{ borderRadius: 2 }}
    />
  )
}
