import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import type {
  BotTeamLinkableWorkspace,
  BotTeamProject,
  BotTeamProjectWorkspace
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import {
  listMobileBotLinkableWorkspaces,
  setMobileBotProjectWorkspace
} from './mobile-bot-team-room-rpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The workspaces the team's host offers; null while loading, 'unavailable' on an older host. */
export type MobileWorkspaceListing = BotTeamLinkableWorkspace[] | 'unavailable' | null

/** Why: a team with Workspaces off is never asked, since the host would only refuse. */
export function useMobileLinkableWorkspaces(
  client: RpcClient,
  teamId: string,
  enabled = true
): MobileWorkspaceListing {
  const [listing, setListing] = useState<MobileWorkspaceListing>(null)
  useEffect(() => {
    if (!enabled) {
      return
    }
    let current = true
    void listMobileBotLinkableWorkspaces(client, teamId).then((result) => {
      if (current) {
        setListing(result.kind === 'ok' ? result.workspaces : 'unavailable')
      }
    })
    return () => {
      current = false
    }
  }, [client, teamId, enabled])
  return enabled ? listing : null
}

/**
 * Advanced options for a Workspaces project: a closed row that opens a list of None and each
 * workspace. Renders nothing until the host lists its workspaces, so an older host shows no row.
 */
export function MobileBotTeamWorkspaceOptions({
  listing,
  value,
  disabled,
  onChange
}: {
  listing: MobileWorkspaceListing
  value: BotTeamProjectWorkspace | null
  disabled: boolean
  onChange: (next: BotTeamProjectWorkspace | null) => void
}) {
  const [open, setOpen] = useState(false)
  if (!Array.isArray(listing)) {
    return null
  }
  // Why: a workspace that is gone keeps its stored name in the list until it is changed.
  const options: BotTeamLinkableWorkspace[] = [
    ...listing,
    ...(value && !listing.some((entry) => entry.key === value.key)
      ? [{ ...value, kind: 'git' as const }]
      : [])
  ]
  return (
    <View style={styles.form}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.row}
      >
        {open ? (
          <ChevronDown size={18} color={colors.textSecondary} />
        ) : (
          <ChevronRight size={18} color={colors.textSecondary} />
        )}
        <Text style={styles.rowTitle}>Advanced options</Text>
      </Pressable>
      {open ? (
        <View style={styles.form}>
          <Text style={styles.label}>Workspaces project</Text>
          {[null, ...options].map((option) => {
            const selected = (option?.key ?? null) === (value?.key ?? null)
            return (
              <Pressable
                key={option?.key ?? 'none'}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => onChange(option)}
                style={[styles.row, selected && styles.rowSelected]}
              >
                {option ? <MobileRepoIcon repoIcon={option.icon} size={18} /> : null}
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{option?.name ?? 'None'}</Text>
                </View>
              </Pressable>
            )
          })}
          <Text style={styles.rowMeta}>
            {value
              ? `Tasks of this project run in ${value.name}.`
              : "Tasks run in the team's own folder."}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/** A connected repository project's Workspaces project, where it can be changed or cleared. */
export function MobileBotTeamWorkspaceLink({
  client,
  teamId,
  project,
  offline,
  onChanged
}: {
  client: RpcClient
  teamId: string
  project: BotTeamProject
  offline: boolean
  onChanged: () => void
}) {
  const listing = useMobileLinkableWorkspaces(client, teamId)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  if (!Array.isArray(listing)) {
    return null
  }
  const linked = project.workspace ?? null
  const save = async (next: BotTeamProjectWorkspace | null) => {
    setSaving(true)
    const result = await setMobileBotProjectWorkspace(client, project.id, next?.key ?? null)
    setSaving(false)
    if (result.kind === 'ok') {
      setNotice(null)
      onChanged()
    } else if (result.kind === 'refused') {
      setNotice(result.message)
    } else if (result.kind === 'unsupported') {
      setNotice('This host cannot link Workspaces projects yet.')
    } else {
      setNotice('That did not save. Check the connection to this host and try again.')
    }
  }
  return (
    <View style={styles.form}>
      <Text style={styles.rowMeta}>
        {linked ? `Linked to ${linked.name}.` : 'Not linked to a Workspaces project.'}
      </Text>
      <MobileBotTeamWorkspaceOptions
        listing={listing}
        value={linked}
        disabled={offline || saving}
        onChange={(next) => void save(next)}
      />
      {notice === null ? null : <Text style={styles.rowMeta}>{notice}</Text>}
    </View>
  )
}
