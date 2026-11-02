import { useState, type ReactNode } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import {
  Bot,
  Brain,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  MessageSquare,
  SlidersHorizontal
} from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { MobileBotTeamEditProject } from './MobileBotTeamEditProject'
import { MobileBotTeamProjectSheet } from './MobileBotTeamProjectSheet'
import { archiveMobileBotProject, deleteMobileBotProject } from './mobile-bot-team-project-rpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

const NO_TEAMS: readonly BotTeam[] = []

/** The room's menu: the team's work, its projects, and what belongs to the team. */
export function MobileBotTeamRoomMenu({
  client,
  teams = NO_TEAMS,
  onChanged,
  visible,
  onClose,
  team,
  working,
  unreachable,
  openCount,
  taskCount,
  projects,
  projectTaskCount,
  onOpenBoard,
  onOpenProject,
  onNewProject,
  onOpenBots,
  onOpenFiles,
  onOpenMemory
}: {
  /** With a client, a long press on a project opens its sheet and Filters can show archived ones. */
  client?: RpcClient
  /** Every team on the host, for the Teams field and the owner of a linked project. */
  teams?: readonly BotTeam[]
  /** After a project was edited, archived, restored or deleted, so the room reads again. */
  onChanged?: () => void
  visible: boolean
  onClose: () => void
  team: BotTeam
  working: boolean
  unreachable: boolean
  openCount: number
  taskCount: number
  projects: readonly BotTeamProject[]
  projectTaskCount: (projectId: string) => number
  onOpenBoard: () => void
  onOpenProject: (projectId: string) => void
  onNewProject: () => void
  onOpenBots: () => void
  onOpenFiles: () => void
  onOpenMemory: () => void
}) {
  const [showArchived, setShowArchived] = useState(false)
  const [sheetProject, setSheetProject] = useState<BotTeamProject | null>(null)
  const [editing, setEditing] = useState<BotTeamProject | null>(null)
  const shown = projects.filter((project) => showArchived || project.archivedAt == null)
  const nameOfOwner = (project: BotTeamProject) =>
    teams.find((entry) => entry.id === project.teamId)?.name ?? team.name

  const archive = async (project: BotTeamProject) => {
    if (!client) {
      return
    }
    setSheetProject(null)
    const result = await archiveMobileBotProject(client, {
      projectId: project.id,
      teamId: team.id,
      archived: project.archivedAt == null
    })
    if (result.kind === 'ok') {
      onChanged?.()
    } else {
      Alert.alert('That did not save', failureText(result, 'archive'))
    }
  }

  const askDelete = (project: BotTeamProject) => {
    setSheetProject(null)
    const count = projectTaskCount(project.id)
    Alert.alert(
      `Delete ${project.name}?`,
      count === 0
        ? 'It has no tasks. Files in the team folder stay.'
        : count === 1
          ? 'Its 1 task and its history are deleted. Files in the team folder stay.'
          : `Its ${count} tasks and their history are deleted. Files in the team folder stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!client) {
              return
            }
            void deleteMobileBotProject(client, { projectId: project.id, teamId: team.id }).then(
              (result) => {
                if (result.kind === 'deleted') {
                  onChanged?.()
                } else {
                  Alert.alert('That did not delete', failureText(result, 'delete'))
                }
              }
            )
          }
        }
      ]
    )
  }

  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <View style={styles.sheetHeader}>
        <MobileBotTeamCharacterIcon
          character={team.character}
          size={28}
          working={working}
          unreachable={unreachable}
        />
        <Text style={styles.sheetTitle}>{team.name}</Text>
      </View>
      <Text style={styles.label}>Work</Text>
      <MenuRow
        icon={<MessageSquare size={18} color={colors.textSecondary} />}
        title="Conference room"
        meta={openCount > 0 ? `${openCount} open` : 'Nothing open'}
        onPress={onClose}
      />
      <MenuRow
        icon={<LayoutGrid size={18} color={colors.textSecondary} />}
        title="Team board"
        meta={taskCount === 0 ? 'No tasks' : taskCount === 1 ? '1 task' : `${taskCount} tasks`}
        onPress={onOpenBoard}
      />
      <View style={styles.sheetHeader}>
        <Text style={[styles.label, styles.grow]}>Projects</Text>
        {client ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showArchived ? 'Filters, Show archived is on' : 'Filters'}
            accessibilityState={{ selected: showArchived }}
            onPress={() => setShowArchived(!showArchived)}
            style={styles.iconButton}
          >
            <SlidersHorizontal
              size={18}
              color={showArchived ? colors.textPrimary : colors.textSecondary}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New project"
          onPress={onNewProject}
          style={styles.iconButton}
        >
          <FolderPlus size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      {shown.map((project) => {
        const archived = project.archivedAt != null
        const linkedHere = project.teamId !== team.id
        const count = projectTaskCount(project.id)
        const owner = teams.find((entry) => entry.id === project.teamId)
        return (
          <MenuRow
            key={project.id}
            icon={<Folder size={18} color={colors.textSecondary} />}
            title={project.name}
            meta={
              archived
                ? 'Archived'
                : linkedHere
                  ? `${count} tasks, owner ${nameOfOwner(project)}`
                  : `${count} tasks`
            }
            dimmed={archived}
            ownerMark={
              linkedHere && owner ? (
                <MobileBotTeamCharacterIcon character={owner.character} size={20} />
              ) : null
            }
            ownerLabel={linkedHere ? `Owner: ${nameOfOwner(project)}` : null}
            onPress={() => onOpenProject(project.id)}
            onLongPress={client ? () => setSheetProject(project) : undefined}
          />
        )
      })}
      {showArchived ? <Text style={styles.rowMeta}>Show archived is on.</Text> : null}
      <Text style={styles.label}>Team</Text>
      <MenuRow
        icon={<Bot size={18} color={colors.textSecondary} />}
        title="Bots"
        onPress={onOpenBots}
      />
      <MenuRow
        icon={<FileText size={18} color={colors.textSecondary} />}
        title="Files"
        onPress={onOpenFiles}
      />
      <MenuRow
        icon={<Brain size={18} color={colors.textSecondary} />}
        title="Memory"
        onPress={onOpenMemory}
      />
      <MobileBotTeamProjectSheet
        project={sheetProject}
        ownerName={sheetProject ? nameOfOwner(sheetProject) : ''}
        ownedByThisTeam={sheetProject?.teamId === team.id}
        onClose={() => setSheetProject(null)}
        onEdit={() => {
          setEditing(sheetProject)
          setSheetProject(null)
        }}
        // Linking is done in the same form, on its Teams field.
        onLinkTeam={() => {
          setEditing(sheetProject)
          setSheetProject(null)
        }}
        onArchive={() => sheetProject && void archive(sheetProject)}
        onDelete={() => sheetProject && askDelete(sheetProject)}
      />
      {client && editing ? (
        <MobileBotTeamEditProject
          client={client}
          project={editing}
          actingTeam={team}
          teams={teams.length > 0 ? teams : [team]}
          onClose={() => setEditing(null)}
          onSaved={() => onChanged?.()}
        />
      ) : null}
    </BottomDrawer>
  )
}

function failureText(
  result: { kind: 'unsupported' } | { kind: 'refused'; message: string } | { kind: 'failed' },
  action: 'archive' | 'delete'
): string {
  if (result.kind === 'unsupported') {
    return `This host cannot ${action} projects yet.`
  }
  return result.kind === 'refused'
    ? result.message
    : 'Check the connection to this host and try again.'
}

function MenuRow({
  icon,
  title,
  meta = null,
  dimmed = false,
  ownerMark = null,
  ownerLabel = null,
  onPress,
  onLongPress
}: {
  icon: ReactNode
  title: string
  meta?: string | null
  /** An archived project: still listed, but quiet. */
  dimmed?: boolean
  ownerMark?: ReactNode
  ownerLabel?: string | null
  onPress: () => void
  onLongPress?: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, dimmed && { opacity: 0.5 }]}
    >
      {icon}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta === null ? null : <Text style={styles.rowMeta}>{meta}</Text>}
      </View>
      {ownerMark ? (
        <View accessibilityRole="image" accessibilityLabel={ownerLabel ?? undefined}>
          {ownerMark}
        </View>
      ) : null}
    </Pressable>
  )
}
