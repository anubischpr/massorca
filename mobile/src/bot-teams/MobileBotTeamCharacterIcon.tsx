import { useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue
} from 'react-native-reanimated'
import Svg, { G, Path } from 'react-native-svg'
import {
  BOT_TEAM_CHARACTER_ART,
  BOT_TEAM_EYE_COLOR,
  BOT_TEAM_EYE_PATH,
  botEyeTransform
} from '../../../src/shared/bot-team-character-art'
import {
  BOT_CHARACTER_IDLE_MAX_MS,
  BOT_CHARACTER_IDLE_MIN_MS,
  BOT_CHARACTER_MOTION,
  BOT_CHARACTER_MOVE_MS,
  botCharacterEffect,
  pickBotCharacterMove,
  type BotCharacterMove
} from '../../../src/shared/bot-team-character-motion'
import type { BotTeamCharacter } from '../../../src/shared/rpc-contract/bot-team-params'
import { useReducedMotionEnabled } from '../onboarding/use-reduced-motion'
import { MobileBotCharacterEffect } from './MobileBotCharacterEffect'
import { useBotCharacterAnimations } from './mobile-bot-character-preference'

const fade = (toValue: number, duration: number) => withTiming(toValue, { duration })

function Eye({
  character,
  index,
  size,
  x,
  y,
  sy
}: {
  character: BotTeamCharacter
  index: 0 | 1
  size: number
  x: SharedValue<number>
  y: SharedValue<number>
  sy: SharedValue<number>
}) {
  const placement = BOT_TEAM_CHARACTER_ART[character].eyes[index]
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scaleY: sy.value }]
  }))
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          transformOrigin: `${(placement.x / 64) * 100}% ${(placement.y / 64) * 100}%`
        },
        style
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path
          d={BOT_TEAM_EYE_PATH}
          transform={botEyeTransform(placement)}
          fill={BOT_TEAM_EYE_COLOR}
        />
      </Svg>
    </Animated.View>
  )
}

export function MobileBotTeamCharacterIcon({
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
}) {
  const art = BOT_TEAM_CHARACTER_ART[character]
  const enabled = useBotCharacterAnimations()
  const reduced = useReducedMotionEnabled() === true
  const motionAllowed = enabled && !reduced && !still
  const animated = motionAllowed && !unreachable
  const effect = botCharacterEffect({
    character,
    working,
    unreachable,
    animated: motionAllowed,
    size
  })
  const orbiting = effect !== null && effect !== 'aura'
  const effectColor = BOT_CHARACTER_MOTION[character].effectColor ?? art.color

  const clock = useSharedValue(0)
  const bodyY = useSharedValue(0)
  const bodyX = useSharedValue(0)
  const bodyRotate = useSharedValue(0)
  const bodyScale = useSharedValue(1)
  const eyeY = useSharedValue(0)
  const eyeScale = useSharedValue(1)
  const eye0X = useSharedValue(0)
  const eye1X = useSharedValue(0)
  const eyesOpacity = useSharedValue(1)
  const happyOpacity = useSharedValue(0)
  const workingRef = useRef(working)
  workingRef.current = working
  const [active, setActive] = useState(AppState.currentState === 'active')

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active')
    )
    return () => subscription.remove()
  }, [])

  // Nothing runs with the app in the background.
  const running = animated && active
  const leaning = running && working
  const unit = size / 64

  useEffect(() => {
    if (running && orbiting) {
      clock.value = 0
      clock.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1)
    } else {
      cancelAnimation(clock)
    }
    return () => cancelAnimation(clock)
  }, [clock, orbiting, running])

  useEffect(() => {
    if (leaning) {
      bodyRotate.value = withRepeat(withSequence(fade(8, 500), fade(5, 500)), -1)
    } else {
      cancelAnimation(bodyRotate)
      bodyRotate.value = fade(0, 150)
    }
  }, [bodyRotate, leaning])

  useEffect(() => {
    if (!running) {
      return
    }
    const eyeOffset = (value: number) => value * unit
    const play = (move: BotCharacterMove): void => {
      const ms = BOT_CHARACTER_MOVE_MS[move]
      const doze = (): void => {
        eyeScale.value = withSequence(
          fade(0.12, ms * 0.3),
          fade(0.12, ms * 0.45),
          fade(1, ms * 0.25)
        )
      }
      switch (move) {
        case 'blink':
          eyeScale.value = withSequence(
            fade(0.08, 140),
            fade(1, 140),
            fade(0.08, 140),
            fade(1, 140)
          )
          return
        case 'look':
          eye0X.value = withSequence(
            fade(eyeOffset(-4), ms * 0.25),
            fade(eyeOffset(4), ms * 0.35),
            fade(0, ms * 0.4)
          )
          eye1X.value = withSequence(
            fade(eyeOffset(-4), ms * 0.25),
            fade(eyeOffset(4), ms * 0.35),
            fade(0, ms * 0.4)
          )
          return
        case 'hop':
          bodyY.value = withSequence(fade(eyeOffset(-9), ms * 0.45), fade(0, ms * 0.55))
          return
        case 'happy':
          eyesOpacity.value = withSequence(fade(0, 120), fade(0, ms - 240), fade(1, 120))
          happyOpacity.value = withSequence(fade(1, 120), fade(1, ms - 240), fade(0, 120))
          return
        case 'breathe':
          bodyScale.value = withSequence(fade(1.04, ms / 2), fade(1, ms / 2))
          return
        case 'tilt':
          if (!workingRef.current) {
            bodyRotate.value = withSequence(
              fade(-8, ms * 0.3),
              fade(-8, ms * 0.4),
              fade(0, ms * 0.3)
            )
          }
          return
        case 'cross':
          eye0X.value = withSequence(
            fade(eyeOffset(3), ms * 0.25),
            fade(eyeOffset(3), ms * 0.5),
            fade(0, ms * 0.25)
          )
          eye1X.value = withSequence(
            fade(eyeOffset(-3), ms * 0.25),
            fade(eyeOffset(-3), ms * 0.5),
            fade(0, ms * 0.25)
          )
          return
        case 'doze':
          doze()
          return
        case 'shake':
          bodyX.value = withSequence(
            fade(eyeOffset(-3), ms * 0.2),
            fade(eyeOffset(3), ms * 0.2),
            fade(eyeOffset(-2), ms * 0.2),
            fade(eyeOffset(2), ms * 0.2),
            fade(0, ms * 0.2)
          )
          return
        case 'attend':
          eyeY.value = withSequence(
            fade(eyeOffset(3), ms * 0.2),
            fade(eyeOffset(3), ms * 0.6),
            fade(0, ms * 0.2)
          )
          return
      }
    }
    let timer: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      const wait =
        BOT_CHARACTER_IDLE_MIN_MS +
        Math.random() * (BOT_CHARACTER_IDLE_MAX_MS - BOT_CHARACTER_IDLE_MIN_MS)
      timer = setTimeout(() => {
        play(pickBotCharacterMove(character, workingRef.current, Math.random()))
        schedule()
      }, wait)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [
    bodyRotate,
    bodyScale,
    bodyX,
    bodyY,
    character,
    eye0X,
    eye1X,
    eyeScale,
    eyeY,
    eyesOpacity,
    happyOpacity,
    running,
    unit
  ])

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: bodyX.value },
      { translateY: bodyY.value },
      { rotate: `${bodyRotate.value}deg` },
      { scale: bodyScale.value }
    ]
  }))
  const eyesStyle = useAnimatedStyle(() => ({ opacity: eyesOpacity.value }))
  const happyStyle = useAnimatedStyle(() => ({ opacity: happyOpacity.value }))

  return (
    <View style={{ width: size, height: size }}>
      {effect ? (
        <MobileBotCharacterEffect
          effect={effect}
          layer="back"
          size={size}
          color={effectColor}
          bodyColor={art.color}
          clock={clock}
        />
      ) : null}
      <Animated.View
        style={[{ width: size, height: size, transformOrigin: '50% 87.5%' }, bodyStyle]}
      >
        <Svg width={size} height={size} viewBox="0 0 64 64" style={{ position: 'absolute' }}>
          <Path
            d={art.body}
            fill={art.color}
            stroke={art.roundedStroke ? art.color : undefined}
            strokeWidth={art.roundedStroke ? 8 : undefined}
            strokeLinejoin="round"
          />
        </Svg>
        <Animated.View style={[{ position: 'absolute', width: size, height: size }, eyesStyle]}>
          <Eye character={character} index={0} size={size} x={eye0X} y={eyeY} sy={eyeScale} />
          <Eye character={character} index={1} size={size} x={eye1X} y={eyeY} sy={eyeScale} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', width: size, height: size }, happyStyle]}>
          <Svg width={size} height={size} viewBox="0 0 64 64">
            <G fill="none" stroke={BOT_TEAM_EYE_COLOR} strokeWidth={2.6} strokeLinecap="round">
              {art.eyes.map(({ x, y }) => (
                <Path key={`${x}-${y}`} d={`M${x - 5} ${y + 2}Q${x} ${y - 5} ${x + 5} ${y + 2}`} />
              ))}
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
      {orbiting ? (
        <MobileBotCharacterEffect
          effect={effect}
          layer="front"
          size={size}
          color={effectColor}
          bodyColor={art.color}
          clock={clock}
        />
      ) : null}
    </View>
  )
}
