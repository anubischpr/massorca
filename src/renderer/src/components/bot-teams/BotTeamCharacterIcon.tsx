import { useEffect, useId, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useAppStore } from '@/store'
import {
  BOT_TEAM_CHARACTER_ART,
  BOT_TEAM_EYE_COLOR,
  BOT_TEAM_EYE_PATH,
  botEyeTransform
} from '../../../../shared/bot-team-character-art'
import {
  BOT_CHARACTER_IDLE_MAX_MS,
  BOT_CHARACTER_IDLE_MIN_MS,
  BOT_CHARACTER_MOTION,
  BOT_CHARACTER_MOVE_MS,
  BOT_CHARACTER_ORBIT_ANGLES,
  botCharacterEffect,
  pickBotCharacterMove,
  type BotCharacterEffect,
  type BotCharacterMove
} from '../../../../shared/bot-team-character-motion'
import type { BotTeamCharacter } from '../../../../shared/rpc-contract/bot-team-params'
import './bot-team-character.css'

const RAINBOW = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6']
const STAR = 'M0-6l1.6 4.4L6 0 1.6 1.6 0 6-1.6 1.6-6 0-1.6-1.6Z'
const BOLT = 'M3-9L-4 1h4l-3 8L6-2H2Z'
const BOLT_COLOR = '#fde047'
const ORBITS: Record<string, number> = { rainbow: 3, electrons: 2, bands: 2, dashes: 2 }
/** Put on a row or card: hovering it moves the team character inside. */
export const BOT_CHARACTER_ZONE_ATTR = 'data-bot-character-zone'

type Layer = 'back' | 'front'

function orbitTransform(angle: number): string {
  return `translate(32 32) rotate(${angle}) scale(1.36 .36) translate(-32 -32)`
}

function halfOrbit(id: string, effect: BotCharacterEffect, color: string, layer: Layer) {
  const angles = BOT_CHARACTER_ORBIT_ANGLES.slice(0, ORBITS[effect] ?? 0)
  return angles.map((angle, index) => (
    <g key={angle} clipPath={`url(#${id}-${layer}${index})`}>
      <g transform={orbitTransform(angle)}>
        {effect === 'rainbow' ? (
          <circle
            className={`bc-fx bc-spin-${index}`}
            cx="32"
            cy="32"
            r="32"
            fill="none"
            stroke={`url(#${id}-rainbow)`}
            strokeWidth="3.2"
          />
        ) : null}
        {effect === 'electrons' ? (
          <circle
            cx="32"
            cy="32"
            r="32"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            opacity=".6"
          />
        ) : null}
        {effect === 'bands' ? (
          <circle
            className="bc-pulse"
            cx="32"
            cy="32"
            r="31"
            fill="none"
            stroke={color}
            strokeWidth="7"
          />
        ) : null}
        {effect === 'dashes' ? (
          <circle
            className={`bc-fx bc-spin-${index}`}
            cx="32"
            cy="32"
            r="32"
            fill="none"
            stroke={color}
            strokeWidth="2.6"
            strokeDasharray="16 11"
            strokeLinecap="round"
          />
        ) : null}
      </g>
      {effect === 'electrons' ? (
        <g transform={`translate(32 32) rotate(${angle})`}>
          <circle className={`bc-electron bc-electron-${index}`} r="3.4" fill={color} />
        </g>
      ) : null}
    </g>
  ))
}

function marks(effect: BotCharacterEffect, color: string, layer: Layer) {
  const places =
    layer === 'back'
      ? [
          [-2, 10, -25, 1.1],
          [66, 16, 20, 1.2],
          [68, 52, 35, 0.9]
        ]
      : [[8, 56, 200, 0.9]]
  if (effect !== 'bolts' && effect !== 'sparkles') {
    return null
  }
  return places.map(([x, y, rotate, scale], index) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path
        className={`bc-mark ${effect === 'bolts' ? 'bc-zap' : 'bc-twinkle'} bc-delay-${layer === 'front' ? 3 : index}`}
        d={effect === 'bolts' ? BOLT : STAR}
        fill={effect === 'bolts' ? BOLT_COLOR : color}
      />
    </g>
  ))
}

export function BotTeamCharacterIcon({
  character,
  size,
  working = false,
  unreachable = false,
  still = false
}: {
  character: BotTeamCharacter
  size: number
  /** From the team's real task status. */
  working?: boolean
  /** Contact is lost: neither working nor stopped, so it shows neither. */
  unreachable?: boolean
  /** A form's preview or a list row that should not draw attention. */
  still?: boolean
}): React.JSX.Element {
  const art = BOT_TEAM_CHARACTER_ART[character]
  const enabled = useAppStore((state) => state.settings?.botTeamCharacterAnimations !== false)
  const animated = enabled && !unreachable && !still
  const id = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const reduceMotion = usePrefersReducedMotion()
  const [move, setMove] = useState<BotCharacterMove | null>(null)
  const workingRef = useRef(working)
  workingRef.current = working

  // Why: each move ends on its own clock, so a newer move (idle or hover) restarts it.
  useEffect(() => {
    if (move === null) {
      return
    }
    const done = setTimeout(() => setMove(null), BOT_CHARACTER_MOVE_MS[move])
    return () => clearTimeout(done)
  }, [move])

  useEffect(() => {
    if (!animated) {
      return
    }
    let idle: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      const wait =
        BOT_CHARACTER_IDLE_MIN_MS +
        Math.random() * (BOT_CHARACTER_IDLE_MAX_MS - BOT_CHARACTER_IDLE_MIN_MS)
      idle = setTimeout(() => {
        // Nothing moves with the app in the background.
        if (document.visibilityState === 'visible') {
          setMove(pickBotCharacterMove(character, workingRef.current, Math.random()))
        }
        schedule()
      }, wait)
    }
    schedule()
    return () => {
      clearTimeout(idle)
      setMove(null)
    }
  }, [animated, character])

  // Why: a hover is the user's gesture, so it moves even a still character; touch is not hover.
  const playHover = (pointerType: string): void => {
    if (!enabled || reduceMotion || pointerType === 'touch' || move !== null) {
      return
    }
    setMove(pickBotCharacterMove(character, working, Math.random()))
  }
  const playHoverRef = useRef(playHover)
  playHoverRef.current = playHover

  // Why: the row or card that holds the character is its hover target too, so entering it moves the character.
  useEffect(() => {
    const zone = svgRef.current?.closest<HTMLElement>(`[${BOT_CHARACTER_ZONE_ATTR}]`)
    if (!zone) {
      return
    }
    const onZoneEnter = (event: PointerEvent): void => playHoverRef.current(event.pointerType)
    zone.addEventListener('pointerenter', onZoneEnter)
    return () => zone.removeEventListener('pointerenter', onZoneEnter)
  }, [])

  const effect = botCharacterEffect({
    character,
    working,
    unreachable,
    animated: enabled && !still,
    size
  })
  const effectColor = BOT_CHARACTER_MOTION[character].effectColor ?? art.color
  const orbiting = effect !== null && effect !== 'aura'
  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-effect={effect ?? undefined}
      onPointerEnter={(event) => playHover(event.pointerType)}
      className={[
        'bc-root shrink-0 overflow-visible',
        animated || move ? '' : 'bc-still',
        working && animated ? 'bc-working' : '',
        move ? `bc-move-${move}` : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {effect !== null ? (
        <defs>
          <radialGradient id={`${id}-glow`}>
            <stop offset="55%" stopColor={art.color} stopOpacity=".55" />
            <stop offset="100%" stopColor={art.color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-rainbow`} x1="0" y1="0" x2="1" y2="1">
            {RAINBOW.map((color, index) => (
              <stop key={color} offset={index / (RAINBOW.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
          {BOT_CHARACTER_ORBIT_ANGLES.map((angle, index) => (
            <g key={angle}>
              <clipPath id={`${id}-back${index}`}>
                <rect
                  x="-50"
                  y="-50"
                  width="164"
                  height="82"
                  transform={`rotate(${angle} 32 32)`}
                />
              </clipPath>
              <clipPath id={`${id}-front${index}`}>
                <rect x="-50" y="32" width="164" height="82" transform={`rotate(${angle} 32 32)`} />
              </clipPath>
            </g>
          ))}
        </defs>
      ) : null}
      {effect === 'aura' ? <circle cx="32" cy="32" r="38" fill={`url(#${id}-glow)`} /> : null}
      {orbiting ? (
        <>
          {marks(effect, effectColor, 'back')}
          {halfOrbit(id, effect, effectColor, 'back')}
        </>
      ) : null}
      <g className="bc-body">
        <path
          d={art.body}
          fill={art.color}
          stroke={art.roundedStroke ? art.color : undefined}
          strokeWidth={art.roundedStroke ? 8 : undefined}
          strokeLinejoin="round"
        />
        <g className="bc-eyes">
          {art.eyes.map((placement, index) => (
            <g key={botEyeTransform(placement)} className={`bc-eye-${index}`}>
              <path
                d={BOT_TEAM_EYE_PATH}
                transform={botEyeTransform(placement)}
                fill={BOT_TEAM_EYE_COLOR}
              />
            </g>
          ))}
        </g>
        <g className="bc-happy" fill="none" stroke={BOT_TEAM_EYE_COLOR} strokeWidth="2.6">
          {art.eyes.map(({ x, y }) => (
            <path
              key={`${x}-${y}`}
              d={`M${x - 5} ${y + 2}Q${x} ${y - 5} ${x + 5} ${y + 2}`}
              strokeLinecap="round"
            />
          ))}
        </g>
      </g>
      {orbiting ? (
        <>
          {halfOrbit(id, effect, effectColor, 'front')}
          {marks(effect, effectColor, 'front')}
        </>
      ) : null}
    </svg>
  )
}
