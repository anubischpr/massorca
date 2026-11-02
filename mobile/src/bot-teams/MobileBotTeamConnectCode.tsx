import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import type {
  BotTeamCodeSource,
  BotTeamProject,
  BotTeamProjectWorkspace
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import {
  setMobileBotProjectCodeSource,
  setMobileBotProjectWorkspace
} from './mobile-bot-team-room-rpc'
import { BOT_TEAM_CODE_SOURCES, botTeamCodeSourceLabel } from './mobile-bot-team-code-source'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import {
  MobileBotTeamWorkspaceOptions,
  useMobileLinkableWorkspaces
} from './MobileBotTeamProjectWorkspace'

/** Connects a project to code, or says where it is connected. The host records the choice only. */
export function MobileBotTeamConnectCode({
  client,
  project,
  offline,
  onChanged
}: {
  client: RpcClient
  project: BotTeamProject
  offline: boolean
  onChanged: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [source, setSource] = useState<BotTeamCodeSource>('repo')
  const [workspace, setWorkspace] = useState<BotTeamProjectWorkspace | null>(null)
  const listing = useMobileLinkableWorkspaces(client, project.teamId)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (project.codeSource !== null) {
    return (
      <Text style={styles.rowMeta}>
        {`Connected to code: ${botTeamCodeSourceLabel(project.codeSource)}.`}
      </Text>
    )
  }

  const connect = async () => {
    setSaving(true)
    const result = await setMobileBotProjectCodeSource(client, project.id, source).finally(() =>
      setSaving(false)
    )
    if (result.kind === 'ok') {
      if (source === 'repo' && workspace !== null) {
        const linked = await setMobileBotProjectWorkspace(client, project.id, workspace.key)
        if (linked.kind === 'refused') {
          Alert.alert('Not linked', linked.message)
        }
      }
      setExpanded(false)
      setNotice(null)
      onChanged()
    } else if (result.kind === 'unsupported') {
      setNotice('This host cannot connect projects to code yet.')
    } else {
      Alert.alert('That did not save', 'Check the connection to this host and try again.')
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Not connected to code</Text>
          <Text style={styles.rowMeta}>Lets this project's tasks work on its code.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: offline }}
          disabled={offline}
          onPress={() => setExpanded((open) => !open)}
          style={styles.secondary}
        >
          <Text style={styles.rowTitle}>Connect to code</Text>
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.form}>
          <Text style={styles.label}>Source</Text>
          {BOT_TEAM_CODE_SOURCES.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              onPress={() => setSource(option.id)}
              style={[styles.row, source === option.id && styles.rowSelected]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{option.label}</Text>
                <Text style={styles.rowMeta}>{option.hint}</Text>
              </View>
            </Pressable>
          ))}
          {source === 'repo' ? (
            <MobileBotTeamWorkspaceOptions
              listing={listing}
              value={workspace}
              disabled={offline || saving}
              onChange={setWorkspace}
            />
          ) : null}
          {notice === null ? null : <Text style={styles.rowMeta}>{notice}</Text>}
          <View style={styles.chips}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpanded(false)}
              style={[styles.secondary, styles.grow]}
            >
              <Text style={styles.rowTitle}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: offline || saving }}
              disabled={offline || saving}
              onPress={() => connect()}
              style={[styles.primary, styles.grow, (offline || saving) && styles.primaryDisabled]}
            >
              <Text style={styles.primaryText}>Connect</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}
