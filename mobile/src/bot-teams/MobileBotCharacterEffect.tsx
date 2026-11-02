import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop
} from 'react-native-svg'
import {
  BOT_CHARACTER_ORBIT_ANGLES,
  type BotCharacterEffect
} from '../../../src/shared/bot-team-character-motion'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const RAINBOW = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6']
const STAR = 'M0-6l1.6 4.4L6 0 1.6 1.6 0 6-1.6 1.6-6 0-1.6-1.6Z'
const BOLT = 'M3-9L-4 1h4l-3 8L6-2H2Z'
const BOLT_COLOR = '#fde047'
const ORBITS: Partial<Record<BotCharacterEffect, number>> = {
  rainbow: 3,
  electrons: 2,
  bands: 2,
  dashes: 2
}
/** The drawing's margin around the 64-unit character, so an orbit is never clipped. */
const MARGIN = 24

export type BotEffectLayer = 'back' | 'front'

function DashedOrbit({
  clock,
  stroke,
  width,
  dash,
  gap,
  turns
}: {
  clock: SharedValue<number>
  stroke: string
  width: number
  dash: number
  gap: number
  turns: number
}) {
  const period = dash + gap
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: -clock.value * period * turns
  }))
  return (
    <AnimatedCircle
      cx={32}
      cy={32}
      r={32}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={[dash, gap]}
      animatedProps={animatedProps}
    />
  )
}

function Band({ clock, color }: { clock: SharedValue<number>; color: string }) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: 0.45 + 0.5 * Math.sin(clock.value * Math.PI) ** 2
  }))
  return (
    <AnimatedCircle
      cx={32}
      cy={32}
      r={31}
      fill="none"
      stroke={color}
      strokeWidth={7}
      animatedProps={animatedProps}
    />
  )
}

function Electron({
  clock,
  color,
  direction
}: {
  clock: SharedValue<number>
  color: string
  direction: 1 | -1
}) {
  const animatedProps = useAnimatedProps(() => {
    const angle = direction * clock.value * 2 * Math.PI
    return { cx: 43.5 * Math.cos(angle), cy: 11.5 * Math.sin(angle) }
  })
  return <AnimatedCircle r={3.4} fill={color} animatedProps={animatedProps} />
}

function Mark({
  clock,
  path,
  color,
  phase,
  flicker
}: {
  clock: SharedValue<number>
  path: string
  color: string
  phase: number
  flicker: boolean
}) {
  const animatedProps = useAnimatedProps(() => {
    const at = (clock.value + phase) % 1
    return flicker
      ? { opacity: at < 0.18 || (at > 0.3 && at < 0.45) ? 1 : 0 }
      : { opacity: 0.25 + 0.75 * Math.sin(at * Math.PI) }
  })
  return <AnimatedPath d={path} fill={color} animatedProps={animatedProps} />
}

const MARKS: Record<BotEffectLayer, readonly (readonly [number, number, number, number])[]> = {
  back: [
    [-2, 10, -25, 1.1],
    [66, 16, 20, 1.2],
    [68, 52, 35, 0.9]
  ],
  front: [[8, 56, 200, 0.9]]
}

/** One side of a working effect: the back half is drawn under the body, the front half over it. */
export function MobileBotCharacterEffect({
  effect,
  layer,
  size,
  color,
  bodyColor,
  clock
}: {
  effect: BotCharacterEffect | 'aura'
  layer: BotEffectLayer
  size: number
  color: string
  bodyColor: string
  clock: SharedValue<number>
}) {
  const scale = size / 64
  const box = 64 + MARGIN * 2
  const angles = BOT_CHARACTER_ORBIT_ANGLES.slice(0, effect === 'aura' ? 0 : (ORBITS[effect] ?? 0))
  return (
    <Svg
      pointerEvents="none"
      width={box * scale}
      height={box * scale}
      viewBox={`${-MARGIN} ${-MARGIN} ${box} ${box}`}
      style={{ position: 'absolute', left: -MARGIN * scale, top: -MARGIN * scale }}
    >
      <Defs>
        <RadialGradient id="glow">
          <Stop offset="55%" stopColor={bodyColor} stopOpacity={0.55} />
          <Stop offset="100%" stopColor={bodyColor} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
          {RAINBOW.map((stop, index) => (
            <Stop key={stop} offset={index / (RAINBOW.length - 1)} stopColor={stop} />
          ))}
        </LinearGradient>
        {angles.map((angle, index) => (
          <ClipPath key={angle} id={`half${index}`}>
            <Rect
              x={-50}
              y={layer === 'back' ? -50 : 32}
              width={164}
              height={82}
              transform={`rotate(${angle} 32 32)`}
            />
          </ClipPath>
        ))}
      </Defs>
      {effect === 'aura' && layer === 'back' ? (
        <Circle cx={32} cy={32} r={38} fill="url(#glow)" />
      ) : null}
      {angles.map((angle, index) => (
        <G key={angle} clipPath={`url(#half${index})`}>
          <G transform={`translate(32 32) rotate(${angle}) scale(1.36 .36) translate(-32 -32)`}>
            {effect === 'rainbow' ? (
              <DashedOrbit
                clock={clock}
                stroke="url(#rainbow)"
                width={3.2}
                dash={78}
                gap={22.5}
                turns={index === 1 ? -1 : 1}
              />
            ) : null}
            {effect === 'dashes' ? (
              <DashedOrbit
                clock={clock}
                stroke={color}
                width={2.6}
                dash={16}
                gap={11}
                turns={index === 1 ? -2 : 2}
              />
            ) : null}
            {effect === 'bands' ? <Band clock={clock} color={color} /> : null}
            {effect === 'electrons' ? (
              <Circle
                cx={32}
                cy={32}
                r={32}
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                opacity={0.6}
              />
            ) : null}
          </G>
          {effect === 'electrons' ? (
            <G transform={`translate(32 32) rotate(${angle})`}>
              <Electron clock={clock} color={color} direction={index === 1 ? -1 : 1} />
            </G>
          ) : null}
        </G>
      ))}
      {effect === 'bolts' || effect === 'sparkles'
        ? MARKS[layer].map(([x, y, rotate, markScale], index) => (
            <G
              key={`${x}-${y}`}
              transform={`translate(${x} ${y}) rotate(${rotate}) scale(${markScale})`}
            >
              <Mark
                clock={clock}
                path={effect === 'bolts' ? BOLT : STAR}
                color={effect === 'bolts' ? BOLT_COLOR : color}
                phase={(index + (layer === 'front' ? 3 : 0)) * 0.25}
                flicker={effect === 'bolts'}
              />
            </G>
          ))
        : null}
    </Svg>
  )
}
