import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Code, Eye } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { MobileNativeChatVisualFrame } from './MobileNativeChatVisualFrame'

export type MobileArtifactHtmlPageProps = {
  /** The page's file name, which the frame shows as its title. */
  title: string
  html: string
  /** The page's source, shown when the reader flips to Source. */
  renderSource: () => ReactNode
}

/**
 * An HTML or SVG page the chat's agent wrote, rendered in the same sandboxed frame as a chat visual:
 * an opaque origin with scripts off the page's own document, a Content-Security-Policy that blocks
 * network and file loads, and link taps handed to the app to open externally (http and https only).
 */
export function MobileArtifactHtmlPage({ title, html, renderSource }: MobileArtifactHtmlPageProps) {
  const [mode, setMode] = useState<'preview' | 'source'>('preview')
  const [failed, setFailed] = useState(false)
  return (
    <View style={styles.container}>
      <View style={styles.toolbar} accessibilityRole="tablist">
        <Pressable
          style={[styles.toggle, mode === 'preview' && styles.toggleActive]}
          onPress={() => setMode('preview')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'preview' }}
          accessibilityLabel="Preview rendered page"
        >
          <Eye size={13} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.toggleText}>Preview</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, mode === 'source' && styles.toggleActive]}
          onPress={() => setMode('source')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'source' }}
          accessibilityLabel="View page source"
        >
          <Code size={13} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.toggleText}>Source</Text>
        </Pressable>
      </View>
      {mode === 'source' ? (
        renderSource()
      ) : failed ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>This page cannot be shown</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try the page again"
            onPress={() => setFailed(false)}
            style={styles.retry}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <MobileNativeChatVisualFrame
          html={html}
          title={title}
          mode="fullscreen"
          onFailed={() => setFailed(true)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  toggleActive: {
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  notice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl
  },
  noticeTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600',
    textAlign: 'center'
  },
  retry: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  retryText: {
    color: colors.textPrimary,
    fontSize: typography.metaSize
  }
})
