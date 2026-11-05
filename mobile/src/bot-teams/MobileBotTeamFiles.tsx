import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { FileText, Share2 } from 'lucide-react-native'
import { MobileFilePreviewBody } from '../files/MobileFilePreviewBody'
import {
  loadMobileFilePreview,
  previewError,
  type MobileFilePreviewResult
} from '../files/mobile-file-preview-request'
import { displayNameFromPreviewPath } from '../files/mobile-file-preview-route'
import { shareMobileFile } from '../files/mobile-file-share'
import { colors, spacing } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { listMobileBotTeamFiles, type MobileBotTeamFilesResult } from './mobile-bot-team-files'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'

/** The team folder's files by path. Opening one shows its text, read-only: versions are not built. */
export function MobileBotTeamFiles({
  client,
  workspaceId,
  offline,
  onBack,
  onOpenFile
}: {
  client: RpcClient
  workspaceId: string | null
  offline: boolean
  onBack: () => void
  onOpenFile: (path: string) => void
}) {
  const [result, setResult] = useState<MobileBotTeamFilesResult | null>(null)

  useEffect(() => {
    if (workspaceId === null || offline) {
      return
    }
    let current = true
    void listMobileBotTeamFiles(client, workspaceId).then((next) => {
      if (current) {
        setResult(next)
      }
    })
    return () => {
      current = false
    }
  }, [client, offline, workspaceId])

  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title="Files" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        {workspaceId === null ? <Text style={styles.message}>No files yet.</Text> : null}
        {result?.kind === 'unsupported' ? (
          <Text style={styles.message}>This host cannot list team files yet.</Text>
        ) : null}
        {result?.kind === 'failed' ? (
          <Text style={styles.message}>Check the connection to this host and try again.</Text>
        ) : null}
        {result?.kind === 'ready' && result.paths.length === 0 ? (
          <Text style={styles.message}>No files yet.</Text>
        ) : null}
        {result?.kind === 'ready'
          ? result.paths.map((path) => (
              <Pressable
                key={path}
                accessibilityRole="button"
                onPress={() => onOpenFile(path)}
                style={styles.row}
              >
                <FileText size={18} color={colors.textSecondary} />
                <Text style={[styles.rowTitle, styles.grow]}>{path}</Text>
              </Pressable>
            ))
          : null}
        <Text style={styles.rowMeta}>
          One bot or person edits a file at a time. Every change is saved as a version.
        </Text>
      </ScrollView>
    </View>
  )
}

const LOADING: MobileFilePreviewResult = { status: 'loading', message: 'Loading preview...' }

/**
 * One file of the team folder, previewed the way the phone previews its own files: an image, text,
 * markdown or media. A room's path is relative to the folder, which the host reads as a worktree.
 */
export function MobileBotTeamFile({
  client,
  workspaceId,
  folderKnown,
  offline,
  path,
  onBack
}: {
  client: RpcClient
  workspaceId: string | null
  /** Whether the room that names the folder has been read; before that the folder is just unknown. */
  folderKnown: boolean
  offline: boolean
  path: string
  onBack: () => void
}) {
  const [preview, setPreview] = useState<MobileFilePreviewResult>(LOADING)
  const [attempt, setAttempt] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const { width, height } = useWindowDimensions()

  useEffect(() => {
    if (workspaceId === null) {
      return
    }
    let current = true
    setPreview(LOADING)
    void loadMobileFilePreview(client, workspaceId, path)
      .catch(() => previewError('Unable to load preview'))
      .then((next) => {
        if (current) {
          setPreview(next)
        }
      })
    return () => {
      current = false
    }
  }, [attempt, client, path, workspaceId])

  const notice =
    workspaceId !== null
      ? null
      : folderKnown
        ? 'This team has no folder yet.'
        : offline
          ? 'Check the connection to this host and try again.'
          : null

  async function share() {
    if (workspaceId === null) {
      return
    }
    setSharing(true)
    setShareNote('')
    try {
      const outcome = await shareMobileFile(
        client,
        { worktreeId: workspaceId, relativePath: path },
        displayNameFromPreviewPath(path)
      )
      if (outcome === 'unavailable') {
        setShareNote('Sharing is not available on this device.')
      }
    } catch (error) {
      setShareNote(error instanceof Error ? error.message : 'Unable to share this file')
    } finally {
      setSharing(false)
    }
  }

  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title={path} onBack={onBack} />
      {notice ? (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.message}>{notice}</Text>
        </ScrollView>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share file"
            disabled={workspaceId === null || offline || sharing}
            onPress={() => void share()}
            style={[
              styles.secondary,
              styles.fileShare,
              (workspaceId === null || offline || sharing) && styles.disabledAction
            ]}
          >
            <Share2 size={18} color={colors.textSecondary} />
            <Text style={styles.rowTitle}>Share</Text>
          </Pressable>
          {shareNote ? <Text style={styles.rowMeta}>{shareNote}</Text> : null}
          <MobileFilePreviewBody
            preview={preview}
            client={client}
            relativePath={path}
            title={displayNameFromPreviewPath(path)}
            editable={false}
            draftContent=""
            saveError=""
            lineColumn={null}
            imageWidth={Math.max(1, width - spacing.md * 2)}
            imageHeight={Math.max(240, height - 160)}
            onDraftChange={() => undefined}
            onImageError={() => setPreview(previewError('Unable to load preview'))}
            onRetry={() => setAttempt((count) => count + 1)}
          />
        </>
      )}
    </View>
  )
}
