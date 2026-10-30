import Svg, { Path } from 'react-native-svg'

const STAR_PATH = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'

/** The merge star: filled when the direction is starred, an outline when it is not. */
export function MobilePrototypeStarIcon({
  size,
  filled,
  color,
  strokeWidth
}: {
  size: number
  filled: boolean
  color: string
  strokeWidth: number
}) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <Path
        d={STAR_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
