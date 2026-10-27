import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { FileCode, FileText } from 'lucide-react-native'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { useNow } from '../hooks/use-now'
import { colors } from '../theme/mobile-theme'
import {
  filterRecordedFiles,
  fileNameOf,
  groupRecordedFilesByDay,
  artifactFilterLabel,
  viewerKindOf,
  type MobileRecordedFilterId
} from './mobile-chat-artifacts-model'
import { artifactsStyles as styles } from './mobile-chat-artifacts-styles'
import { mobileChatSurfaceKey, useMobileChatSurfaceSnapshot } from './mobile-chat-surface-snapshot'
import {
  mobileNativeChatRecordedFiles,
  type MobileNativeChatRecordedFile
} from './mobile-native-chat-recorded-files'

const FILTERS: MobileRecordedFilterId[] = ['all', 'pages', 'files']

export type MobileChatArtifactsViewProps = {
  hostId: string
  worktreeId: string
  tabId: string
  onOpenFile: (path: string) => void
}

/** The files this chat's agent wrote, as pages to open and files to read. Reads the chat from the
 *  snapshot the session screen publishes for this tab. */
export function MobileChatArtifactsView({
  hostId,
  worktreeId,
  tabId,
  onOpenFile
}: MobileChatArtifactsViewProps) {
  const snapshot = useMobileChatSurfaceSnapshot(mobileChatSurfaceKey(hostId, worktreeId, tabId))
  const [filter, setFilter] = useState<MobileRecordedFilterId>('all')
  const now = useNow(60_000)
  const files = useMemo(
    () => (snapshot ? mobileNativeChatRecordedFiles(snapshot.messages) : []),
    [snapshot]
  )

  if (!snapshot) {
    return (
      <View style={styles.emptyPage}>
        <Text style={styles.emptyTitle}>Open this chat to see its artifacts</Text>
        <Text style={styles.emptyBody}>The list follows the chat that is on screen.</Text>
      </View>
    )
  }

  const pages = filterRecordedFiles(files, 'pages')
  const others = filterRecordedFiles(files, 'files')
  const pageGroups = groupRecordedFilesByDay(pages, now)
  const showPages = filter !== 'files' && pages.length > 0
  const showFiles = filter !== 'pages' && others.length > 0

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((id) => (
          <FilterChip
            key={id}
            label={artifactFilterLabel(id)}
            count={countFor(id, pages.length, others.length, files.length)}
            selected={filter === id}
            onPress={() => setFilter(id)}
          />
        ))}
      </View>

      {showPages
        ? pageGroups.map((group) => (
            <View key={group.key}>
              <SheetSectionLabel label={group.label ?? 'Pages'} count={group.files.length} />
              <View style={styles.pageGrid}>
                {group.files.map((file) => (
                  <PageTile key={file.path} file={file} onOpen={onOpenFile} />
                ))}
              </View>
            </View>
          ))
        : null}

      {showFiles ? (
        <View>
          <SheetSectionLabel label="Files" count={others.length} />
          {others.map((file) => (
            <FileRow key={file.path} file={file} onOpen={onOpenFile} />
          ))}
        </View>
      ) : null}

      {(filter === 'all' && files.length === 0) ||
      (filter === 'pages' && pages.length === 0) ||
      (filter === 'files' && others.length === 0) ? (
        <Text style={styles.emptyLine}>
          {filter === 'pages'
            ? 'No pages yet. HTML, Markdown and SVG files the agent writes appear here.'
            : filter === 'files'
              ? 'No other files yet.'
              : 'Nothing written in this chat yet.'}
        </Text>
      ) : null}
    </ScrollView>
  )
}

function countFor(id: MobileRecordedFilterId, pages: number, others: number, all: number): number {
  if (id === 'pages') {
    return pages
  }
  return id === 'files' ? others : all
}

function FilterChip({
  label,
  count,
  selected,
  onPress
}: {
  label: string
  count: number
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count}`}
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{label}</Text>
      <Text style={styles.filterCount}>{count}</Text>
    </Pressable>
  )
}

function PageTile({
  file,
  onOpen
}: {
  file: MobileNativeChatRecordedFile
  onOpen: (path: string) => void
}) {
  const kind = viewerKindOf(file.path)
  const Glyph = kind.kind === 'markdown' ? FileText : FileCode
  const name = fileNameOf(file.path)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      onPress={() => onOpen(file.path)}
      style={styles.pageTile}
    >
      <View style={styles.pageArt}>
        <Glyph size={26} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.kindChip}>{kind.label}</Text>
      </View>
      <Text style={styles.pageName} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  )
}

function FileRow({
  file,
  onOpen
}: {
  file: MobileNativeChatRecordedFile
  onOpen: (path: string) => void
}) {
  const name = fileNameOf(file.path)
  const hasCounts = file.added !== null || file.removed !== null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      onPress={() => onOpen(file.path)}
      style={styles.fileRow}
    >
      <FileText size={15} color={colors.textSecondary} strokeWidth={2} />
      <Text style={styles.fileName} numberOfLines={1}>
        {name}
      </Text>
      {hasCounts ? (
        <Text style={styles.counts}>
          <Text style={styles.added}>{`+${file.added ?? 0}`}</Text>
          <Text style={styles.removed}>{` −${file.removed ?? 0}`}</Text>
        </Text>
      ) : null}
    </Pressable>
  )
}
