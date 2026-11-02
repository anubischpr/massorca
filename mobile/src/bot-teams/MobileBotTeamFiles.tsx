import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { FileText } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import {
  listMobileBotTeamFiles,
  readMobileBotTeamFile,
  type MobileBotTeamFileResult,
  type MobileBotTeamFilesResult
} from './mobile-bot-team-files'
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

/** One file of the team folder as text, read-only. */
export function MobileBotTeamFile({
  client,
  workspaceId,
  path,
  onBack
}: {
  client: RpcClient
  workspaceId: string | null
  path: string
  onBack: () => void
}) {
  const [file, setFile] = useState<MobileBotTeamFileResult | null>(null)

  useEffect(() => {
    if (workspaceId === null) {
      return
    }
    let current = true
    void readMobileBotTeamFile(client, workspaceId, path).then((next) => {
      if (current) {
        setFile(next)
      }
    })
    return () => {
      current = false
    }
  }, [client, path, workspaceId])

  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title={path} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        {file?.kind === 'ready' ? (
          <Text selectable style={styles.rowTitle}>
            {file.content}
          </Text>
        ) : null}
        {workspaceId === null || file?.kind === 'failed' ? (
          <Text style={styles.message}>This file cannot be opened here.</Text>
        ) : null}
      </ScrollView>
    </View>
  )
}
