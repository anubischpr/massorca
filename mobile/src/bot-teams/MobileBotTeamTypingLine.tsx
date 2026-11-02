import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
import { botTeamTypingAuthor } from '../../../src/shared/bot-team-typing'
import type { BotTeamBot } from '../../../src/shared/rpc-contract/bot-team-params'
import { useReducedMotionEnabled } from '../onboarding/use-reduced-motion'
import { colors } from '../theme/mobile-theme'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'

function Dot({ delay, still }: { delay: number; still: boolean }) {
  const opacity = useSharedValue(still ? 0.6 : 0.3)
  useEffect(() => {
    if (still) {
      return
    }
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
        -1
      )
    )
    return () => cancelAnimation(opacity)
  }, [delay, opacity, still])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted }, style]}
    />
  )
}

/** "{bot} is typing" with three dots while the host prepares the room's reply. */
export function MobileBotTeamTypingLine({
  text,
  bots
}: {
  /** The person's message that is with the host. */
  text: string
  bots: readonly BotTeamBot[]
}) {
  const still = useReducedMotionEnabled() === true
  const author = botTeamTypingAuthor(text, bots)
  const label =
    author.kind === 'bot'
      ? `${author.bot.name} is typing`
      : author.kind === 'all'
        ? 'All is typing'
        : 'Typing'
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {author.kind === 'bot' ? <MobileBotAgentIcon agentId={author.bot.agent} size={14} /> : null}
      {author.kind === 'all'
        ? bots.map((bot) => <MobileBotAgentIcon key={bot.id} agentId={bot.agent} size={14} />)
        : null}
      <Text style={{ fontSize: 13, color: colors.textMuted }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0, 160, 320].map((delay) => (
          <Dot key={delay} delay={delay} still={still} />
        ))}
      </View>
    </View>
  )
}
