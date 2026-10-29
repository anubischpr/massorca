import type { DesignSystemPanelProps } from './prototype-design-system-props'
import { PrototypeDesignSystemDraft } from './PrototypeDesignSystemDraft'
import { PrototypeDesignSystemSelection } from './PrototypeDesignSystemSelection'

/** The aside beside a design system: the selected token or component, then the draft that Send carries. */
export function PrototypeDesignSystemAside(props: DesignSystemPanelProps): React.JSX.Element {
  return (
    <>
      <PrototypeDesignSystemSelection {...props} />
      <PrototypeDesignSystemDraft {...props} />
    </>
  )
}
