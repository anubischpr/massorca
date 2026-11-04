import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import { marketplaceStyles as styles } from './marketplace-styles'

export type MarketplaceStatusTone = 'ok' | 'warn' | 'bad' | 'pending'

function toneColor(tone: MarketplaceStatusTone): string {
  switch (tone) {
    case 'ok':
      return colors.statusGreen
    case 'warn':
      return colors.statusAmber
    case 'bad':
      return colors.statusRed
    case 'pending':
      return colors.textMuted
  }
}

export function MarketplaceScreenFrame({
  title,
  onBack,
  children
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
          onPress={onBack}
        >
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function MarketplaceStatusLine({
  tone,
  text
}: {
  tone: MarketplaceStatusTone
  text: string
}) {
  return (
    <View style={styles.statusLine}>
      <View style={[styles.dot, { backgroundColor: toneColor(tone) }]} />
      <Text style={styles.rowMeta}>{text}</Text>
    </View>
  )
}

export function MarketplaceAppHeader({
  tile,
  title,
  titleSize = 20,
  subtitle,
  status
}: {
  tile: ReactNode
  title: string
  titleSize?: number
  subtitle?: string
  status?: { tone: MarketplaceStatusTone; text: string } | null
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.tileLarge}>{tile}</View>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle20, { fontSize: titleSize }]}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        {status ? <MarketplaceStatusLine tone={status.tone} text={status.text} /> : null}
      </View>
    </View>
  )
}

export function MarketplaceNotice({ text, bad = false }: { text: string; bad?: boolean }) {
  return <Text style={bad ? styles.noteBad : styles.note}>{text}</Text>
}

export function MarketplacePending({
  connected,
  hostName
}: {
  connected: boolean
  hostName: string
}) {
  return (
    <View style={styles.pending}>
      <ActivityIndicator color={colors.textSecondary} />
      {!connected && hostName !== '' ? (
        <Text style={styles.rowMeta}>{`Connecting to ${hostName}…`}</Text>
      ) : null}
    </View>
  )
}
