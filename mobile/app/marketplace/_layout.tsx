import { Stack } from 'expo-router'
import { colors } from '../../src/theme/mobile-theme'

export default function MarketplaceLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}
    />
  )
}
