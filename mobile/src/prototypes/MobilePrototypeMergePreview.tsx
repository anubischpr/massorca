import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { Info } from 'lucide-react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { PROTOTYPE_UNREADABLE_LINE } from './MobilePrototypeFrame'

const PAGE_HEIGHT = 480

/**
 * The composed merge page, drawn in a view with scripts off and no network: the page is only the
 * inline document, and a request for anything else is refused. The info button shows the
 * approximation note inline.
 */
export function MobilePrototypeMergePreview({
  name,
  agentName,
  html,
  failed
}: {
  /** "C · preview". */
  name: string
  agentName: string
  /** The composed page; null until it is composed for the parts as they are now. */
  html: string | null
  /** The page could not be composed. */
  failed: boolean
}) {
  const [info, setInfo] = useState(false)
  const source = useMemo(() => (html === null ? null : { html }), [html])
  return (
    <View style={styles.pane}>
      <View style={styles.head}>
        <Text style={styles.label}>{name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About the preview"
          accessibilityState={{ expanded: info }}
          onPress={() => setInfo((open) => !open)}
          style={styles.info}
        >
          <Info size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      {info ? (
        <Text style={styles.note}>
          {`This preview is an approximation. ${agentName} generates the final result, and it may vary with the agent's ability.`}
        </Text>
      ) : null}
      {source !== null ? (
        <View style={styles.frame}>
          <WebView
            source={source}
            style={styles.page}
            javaScriptEnabled={false}
            originWhitelist={['about:blank']}
            onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
            domStorageEnabled={false}
            allowFileAccess={false}
            setSupportMultipleWindows={false}
          />
        </View>
      ) : failed ? (
        <Text style={styles.failed}>{PROTOTYPE_UNREADABLE_LINE}</Text>
      ) : (
        <View testID="mobile-merge-page-skeleton" style={[styles.frame, styles.placeholder]} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pane: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  info: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  note: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19
  },
  frame: {
    height: PAGE_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceBright
  },
  placeholder: { backgroundColor: colors.bgPanel },
  page: { flex: 1 },
  failed: {
    paddingVertical: spacing.lg,
    color: colors.textSecondary,
    fontSize: typography.metaSize + 2
  }
})
