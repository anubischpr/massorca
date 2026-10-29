import type { DesignSystemPanelProps } from './prototype-design-system-props'
import { PrototypeDesignSystemDraft } from './PrototypeDesignSystemDraft'
import { PrototypeDesignSystemPalettes } from './PrototypeDesignSystemPalettes'
import { PrototypeDesignSystemSelection } from './PrototypeDesignSystemSelection'

/**
 * The aside beside a design system: the palette review while a proposed system has palettes to pick from,
 * else the selected token or component; then the draft that Send carries.
 */
export function PrototypeDesignSystemAside(props: DesignSystemPanelProps): React.JSX.Element {
  const reviewing = props.system.status === 'proposed' && props.content.meta.palettes.length > 0
  return (
    <>
      {reviewing ? (
        <PrototypeDesignSystemPalettes {...props} />
      ) : (
        <PrototypeDesignSystemSelection {...props} />
      )}
      <PrototypeDesignSystemDraft {...props} />
    </>
  )
}
