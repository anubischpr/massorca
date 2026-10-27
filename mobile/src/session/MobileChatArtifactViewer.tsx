import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { RefreshCw } from 'lucide-react-native'
import { MobileFileMarkdownPreview } from '../files/MobileFileMarkdownPreview'
import { MobileFilePreviewSourceText } from '../files/MobileFilePreviewSourceText'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { fileNameOf, viewerKindOf, type MobileArtifactTarget } from './mobile-chat-artifacts-model'
import { mobileChatSurfaceKey, useMobileChatSurfaceSnapshot } from './mobile-chat-surface-snapshot'
import { MobileArtifactHtmlPage } from './MobileArtifactHtmlPage'
import { MobileNativeChatVisualFrame } from './MobileNativeChatVisualFrame'
import { RECORDED_FILE_REFUSAL_COPY } from './mobile-recorded-file-read'
import { useMobileNativeChatVisual } from './use-mobile-native-chat-visual'
import { useMobileRecordedFile, type MobileRecordedFileState } from './use-mobile-recorded-file'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'

export type MobileChatArtifactViewerProps = {
  hostId: string
  worktreeId: string
  tabId: string
  target: MobileArtifactTarget
}

/** One file the chat's agent wrote, or one visual its replies showed; read-only. */
export function MobileChatArtifactViewer({
  hostId,
  worktreeId,
  tabId,
  target
}: MobileChatArtifactViewerProps) {
  const snapshot = useMobileChatSurfaceSnapshot(mobileChatSurfaceKey(hostId, worktreeId, tabId))
  const source = snapshot?.recordedSource ?? null

  if (!snapshot) {
    return <Notice title="Open this chat to read its files" />
  }
  if (!source) {
    return <Notice title="This chat does not share its files with the phone" />
  }
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        {target.kind === 'visual' ? (
          <VisualBody source={source} file={target.file} />
        ) : (
          <RecordedBody source={source} path={target.path} />
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.readOnly}>Read-only</Text>
      </View>
    </View>
  )
}

function RecordedBody({ source, path }: { source: MobileChatSurfaceRecordedSource; path: string }) {
  const { state, retry } = useMobileRecordedFile(source, path)
  return <RecordedState path={path} state={state} onRetry={retry} />
}

/** A visual the chat showed, in the same sandboxed frame the transcript draws it with. */
function VisualBody({ source, file }: { source: MobileChatSurfaceRecordedSource; file: string }) {
  const { state, retry } = useMobileNativeChatVisual(source, file)
  const [failed, setFailed] = useState(false)
  if (state.kind === 'loading') {
    return <Centered />
  }
  if (state.kind === 'unavailable' || failed) {
    return (
      <Notice title="This visual is not available" body="Check the connection, then try again.">
        <RetryButton
          onRetry={() => {
            setFailed(false)
            retry()
          }}
        />
      </Notice>
    )
  }
  return (
    <MobileNativeChatVisualFrame
      html={state.html}
      title={file}
      mode="fullscreen"
      onFailed={() => setFailed(true)}
    />
  )
}

function RecordedState({
  path,
  state,
  onRetry
}: {
  path: string
  state: MobileRecordedFileState
  onRetry: () => void
}) {
  if (state.kind === 'loading') {
    return <Centered />
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
      <RetryButton onRetry={onRetry} />
    </Notice>
  )
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
      <RefreshCw size={14} color={colors.textPrimary} strokeWidth={2.2} />
      <Text style={styles.retryText}>Retry</Text>
    </Pressable>
  )
}

function Centered() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.textMuted} />
    </View>
  )
}

/** The rendered view for pages and Markdown, with the source one tap away; plain source for code. */
function ReadyContent({ path, content }: { path: string; content: string }) {
  const kind = viewerKindOf(path).kind
  const size = { truncated: false, byteLength: content.length }
  if (kind === 'html') {
    return (
      <MobileArtifactHtmlPage
        title={fileNameOf(path)}
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
