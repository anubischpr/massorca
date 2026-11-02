import { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { BotTeamEngramReply } from '../../../src/shared/rpc-contract/bot-team-engram-params'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import { listMobileBotTeamEngramMemory } from './mobile-bot-team-engram-rpc'
import { listMobileBotTeamRoom } from './mobile-bot-team-room-rpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

function statusLine(reply: BotTeamEngramReply, searched: boolean): string | null {
  if (reply.status === 'unavailable') {
    return 'Engram is not available on this host.'
  }
  if (reply.status === 'failed') {
    return 'Could not read Engram. Try again.'
  }
  if (reply.memories.length === 0) {
    return searched
      ? 'No Engram memories match that search.'
      : `No Engram memories for ${reply.projectName ?? ''} yet.`
  }
  return null
}

/** The linked Workspaces project's Engram memories, read-only: the latest few, or a search. */
export function MobileBotTeamEngramMemory({
  client,
  team,
  offline
}: {
  client: RpcClient
  team: BotTeam
  offline: boolean
}) {
  const [projects, setProjects] = useState<BotTeamProject[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [reply, setReply] = useState<BotTeamEngramReply | null>(null)

  useEffect(() => {
    if (offline || !team.workspacesEnabled) {
      return
    }
    let current = true
    void listMobileBotTeamRoom(client, team.id).then((room) => {
      const linked = (room?.projects ?? []).filter((project) => project.workspace)
      if (current) {
        setProjects(linked)
        setProjectId((chosen) => chosen ?? linked[0]?.id ?? null)
      }
    })
    return () => {
      current = false
    }
  }, [client, offline, team.id, team.workspacesEnabled])

  useEffect(() => {
    if (offline || !projectId) {
      return
    }
    let current = true
    setReply(null)
    void listMobileBotTeamEngramMemory(client, {
      teamId: team.id,
      projectId,
      ...(query ? { query } : {})
    }).then((next) => {
      if (current) {
        setReply(next)
      }
    })
    return () => {
      current = false
    }
  }, [client, offline, team.id, projectId, query])

  if (!team.workspacesEnabled || projects.length === 0) {
    return null
  }
  const line = reply ? statusLine(reply, query !== '') : null
  return (
    <View style={styles.form}>
      <Text style={styles.rowTitle}>Engram</Text>
      <Text style={styles.rowMeta}>
        Memories Engram keeps for this project. You can read them here, not change them.
      </Text>
      {projects.length > 1 ? (
        <View style={styles.chips}>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              accessibilityRole="button"
              accessibilityState={{ selected: project.id === projectId }}
              onPress={() => {
                setProjectId(project.id)
                setDraft('')
                setQuery('')
              }}
              style={[styles.chip, project.id === projectId && styles.rowSelected]}
            >
              <Text style={styles.rowTitle}>{project.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="Search Engram memories"
        placeholder="Search Engram memories"
        value={draft}
        maxLength={200}
        returnKeyType="search"
        onChangeText={(text) => {
          setDraft(text)
          if (text.trim() === '') {
            setQuery('')
          }
        }}
        onSubmitEditing={() => setQuery(draft.trim())}
        style={styles.input}
      />
      {reply?.status === 'ok'
        ? reply.memories.map((memory) => (
            <View key={memory.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{memory.title}</Text>
                {memory.type ? <Text style={styles.rowMeta}>{memory.type}</Text> : null}
                <Text style={styles.rowMeta}>{memory.excerpt}</Text>
              </View>
            </View>
          ))
        : null}
      {line ? <Text style={styles.message}>{line}</Text> : null}
    </View>
  )
}
