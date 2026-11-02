import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  Bot,
  Brain,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  MessageSquare
} from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors } from '../theme/mobile-theme'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The room's menu: the team's work, its projects, and what belongs to the team. */
export function MobileBotTeamRoomMenu({
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
        meta={taskCount > 0 ? `${taskCount} tasks` : 'No tasks'}
        onPress={onOpenBoard}
      />
      <Text style={styles.label}>Projects</Text>
      {projects.map((project) => (
        <MenuRow
          key={project.id}
          icon={<Folder size={18} color={colors.textSecondary} />}
          title={project.name}
          meta={`${projectTaskCount(project.id)} tasks`}
          onPress={() => onOpenProject(project.id)}
        />
      ))}
      <MenuRow
        icon={<FolderPlus size={18} color={colors.textSecondary} />}
        title="New project"
        onPress={onNewProject}
      />
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
    </BottomDrawer>
  )
}

function MenuRow({
  icon,
  title,
  meta = null,
  onPress
}: {
  icon: ReactNode
  title: string
  meta?: string | null
  onPress: () => void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      {icon}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta === null ? null : <Text style={styles.rowMeta}>{meta}</Text>}
      </View>
    </Pressable>
  )
}
