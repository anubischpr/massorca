import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type LayoutChangeEvent
} from 'react-native'
import { colors } from '../theme/mobile-theme'

const PULSE_MS = 500
const PULSE_COUNT = 2
const GLOW_SCALE = 1.06

/**
 * A control a draft item jumped to: a blue ring that stays while its pin is open, and a glow that
 * pulses twice on arrival. With reduced motion there is the ring and no pulse.
 */
export function MobilePrototypePulse({
  ring,
  nonce,
  onLayout,
  children
}: {
  ring: boolean
  /** A new nonce is a new arrival: the glow plays again. */
  nonce: number
  onLayout?: (event: LayoutChangeEvent) => void
  children: ReactNode
}) {
  const glow = useRef(new Animated.Value(0)).current
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled)
      }
    })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!ring || reduceMotion) {
      return
    }
    glow.setValue(0)
    const animation = Animated.loop(
      Animated.timing(glow, {
        toValue: 1,
        duration: PULSE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      { iterations: PULSE_COUNT }
    )
    animation.start()
    return () => animation.stop()
  }, [glow, nonce, reduceMotion, ring])

  return (
    <View onLayout={onLayout} style={[styles.row, ring && styles.rowRing]}>
      {children}
      {ring && !reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
              transform: [
                { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, GLOW_SCALE] }) }
              ]
            }
          ]}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 10
  },
  rowRing: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlueTint
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: 10,
    borderColor: colors.accentBlue
  }
})
