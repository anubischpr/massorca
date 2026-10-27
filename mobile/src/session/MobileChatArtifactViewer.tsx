import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import { MobileHtmlPreview } from '../components/MobileHtmlPreview'
import { MobileFileMarkdownPreview } from '../files/MobileFileMarkdownPreview'
import { MobileFilePreviewSourceText } from '../files/MobileFilePreviewSourceText'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { viewerKindOf } from './mobile-chat-artifacts-model'
import { mobileChatSurfaceKey, useMobileChatSurfaceSnapshot } from './mobile-chat-surface-snapshot'
import { RECORDED_FILE_REFUSAL_COPY } from './mobile-recorded-file-read'
import { useMobileRecordedFile, type MobileRecordedFileState } from './use-mobile-recorded-file'

export type MobileChatArtifactViewerProps = {
  hostId: string
  worktreeId: string
  tabId: string
  path: string
}

/** One file the chat's agent wrote, read-only: a rendered page or Markdown, or its source. */
export function MobileChatArtifactViewer({
  hostId,
  worktreeId,
  tabId,
  path
}: MobileChatArtifactViewerProps) {
  const snapshot = useMobileChatSurfaceSnapshot(mobileChatSurfaceKey(hostId, worktreeId, tabId))
  const source = snapshot?.recordedSource ?? null
  const { state, retry } = useMobileRecordedFile(source, path)

  if (!snapshot) {
    return <Notice title="Open this chat to read its files" />
  }
  if (!source) {
    return <Notice title="This chat does not share its files with the phone" />
  }
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <ViewerBody path={path} state={state} onRetry={retry} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.readOnly}>Read-only</Text>
      </View>
    </View>
  )
}

function ViewerBody({
  path,
  state,
  onRetry
}: {
  path: string
  state: MobileRecordedFileState
  onRetry: () => void
}) {
  if (state.kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    )
  }
  if (state.kind === 'ready') {
    return <ReadyContent path={path} content={state.content} />
  }
  if (state.kind === 'binary') {
    return (
      <Notice title="No preview for this file" body="It holds binary data the phone cannot show." />
    )
  }
  if (state.kind === 'refused') {
    return <Notice title={RECORDED_FILE_REFUSAL_COPY[state.reason]} />
  }
  if (state.kind === 'unavailable') {
    return (
      <Notice
        title="Update Orca on this computer"
        body="Then you can open files from your phone."
      />
    )
  }
  return (
    <Notice
      title="Could not reach the paired computer"
      body="Check the connection, then try again."
    >
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <RefreshCw size={14} color={colors.textPrimary} strokeWidth={2.2} />
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </Notice>
  )
}

/** The rendered view for pages and Markdown, with the source one tap away; plain source for code. */
function ReadyContent({ path, content }: { path: string; content: string }) {
  const kind = viewerKindOf(path).kind
  const size = { truncated: false, byteLength: content.length }
  if (kind === 'html') {
    return (
      <MobileHtmlPreview
        html={content}
        renderSource={() => (
          <MobileFilePreviewSourceText relativePath={path} content={content} {...size} />
        )}
      />
    )
  }
  if (kind === 'markdown') {
    return <MobileFileMarkdownPreview relativePath={path} content={content} {...size} />
  }
  return <MobileFilePreviewSourceText relativePath={path} content={content} {...size} />
}

function Notice({
  title,
  body,
  children
}: {
  title: string
  body?: string
  children?: React.ReactNode
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.noticeTitle}>{title}</Text>
      {body ? <Text style={styles.noticeBody}>{body}</Text> : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  body: {
    flex: 1
  },
  center: {
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
  noticeBody: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    textAlign: 'center'
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  retryText: {
    color: colors.textPrimary,
    fontSize: typography.metaSize
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle
  },
  readOnly: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  }
})
