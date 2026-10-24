import Svg, { G, Path } from 'react-native-svg'
import { colors } from '../theme/mobile-theme'
import { MASSORCA_ROSE_PATHS, MASSORCA_ROSE_VIEWBOX } from './massorca-rose-paths'

type Props = {
  size?: number
  color?: string
}

export function OrcaLogo({ size = 24, color = colors.textPrimary }: Props) {
  return (
    <Svg width={size} height={size} viewBox={MASSORCA_ROSE_VIEWBOX}>
      <G fill={color}>
        {MASSORCA_ROSE_PATHS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
    </Svg>
  )
}
