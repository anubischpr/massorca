import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native'
import { FileCode, FileText } from 'lucide-react-native'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { useNow } from '../hooks/use-now'
import { useMobilePrototypeChatSets } from '../prototypes/use-mobile-prototype-chat-sets'
import { colors } from '../theme/mobile-theme'
import { MobileArtifactPagePreview } from './MobileArtifactPagePreview'
import {
  ArtifactScrollScopeContext,
  useArtifactTileNearViewport,
  type ArtifactScrollScope
} from './mobile-artifact-scroll-scope'
import {
  mobileChatSurfaceKey,
  useMobileChatSurfaceSnapshot,
  type MobileChatSurfaceRecordedSource
} from './mobile-chat-surface-snapshot'
import { mobileNativeChatVisualPages } from './mobile-chat-visual-pages'
import {
  artifactFilterLabel,
  boundDesignFoldersOf,
  chatArtifactPages,
  filterRecordedFiles,
  groupRecordedFilesByDay,
  fileNameOf,
  withoutBoundDesignFiles,
  type MobileArtifactPage,
  type MobileArtifactTarget,
  type MobileRecordedFilterId
} from './mobile-chat-artifacts-model'
import { artifactsStyles as styles } from './mobile-chat-artifacts-styles'
import {
  mobileNativeChatRecordedFiles,
  type MobileNativeChatRecordedFile
} from './mobile-native-chat-recorded-files'
import { useArtifactThumbnail } from './use-mobile-artifact-thumbnail'

const FILTERS: MobileRecordedFilterId[] = ['all', 'pages', 'files']

/** The tile's art box; the page thumbnail fills it. */
const PAGE_ART_HEIGHT = 110

export type MobileChatArtifactsViewProps = {
  hostId: string
  worktreeId: string
  tabId: string
  onOpenPage: (target: MobileArtifactTarget) => void
  onOpenFile: (path: string) => void
}

/** The files this chat's agent wrote and the visuals its replies showed: pages to open, files to
 *  read. Reads the chat from the snapshot the session screen publishes for this tab. */
export function MobileChatArtifactsView({
  hostId,
  worktreeId,
  tabId,
  onOpenPage,
  onOpenFile
}: MobileChatArtifactsViewProps) {
  const snapshot = useMobileChatSurfaceSnapshot(mobileChatSurfaceKey(hostId, worktreeId, tabId))
  const [filter, setFilter] = useState<MobileRecordedFilterId>('all')
  const now = useNow(60_000)
  // A Gentle Shell design folder that a prototype set is bound to belongs to the Prototypes view.
  const userTurnCount = useMemo(
    () => (snapshot ? snapshot.messages.filter((message) => message.role === 'user').length : 0),
    [snapshot]
  )
  const sets = useMobilePrototypeChatSets({
    client: snapshot?.recordedSource?.client ?? null,
    sessionId: snapshot?.recordedSource?.sessionId ?? null,
    userTurnCount
  })
  const boundFolders = useMemo(() => boundDesignFoldersOf(sets), [sets])
  const files = useMemo(
    () =>
      snapshot
        ? withoutBoundDesignFiles(
            mobileNativeChatRecordedFiles(snapshot.messages),
            (file) => file.path,
            boundFolders
          )
        : [],
    [boundFolders, snapshot]
  )
  const pages = useMemo(
    () =>
      snapshot
        ? chatArtifactPages(
            files,
            withoutBoundDesignFiles(
              mobileNativeChatVisualPages(snapshot.messages),
              (visual) => visual.file,
              boundFolders
            )
          )
        : [],
    [boundFolders, files, snapshot]
  )
  // Tiles near the viewport ask for their thumbnails; scrolling tells them to look again.
  const viewport = useRef<View>(null)
  const scrollListeners = useRef(new Set<() => void>())
  const scope = useMemo<ArtifactScrollScope>(
    () => ({
      viewport,
      subscribe: (listener) => {
        scrollListeners.current.add(listener)
        return () => {
          scrollListeners.current.delete(listener)
        }
      }
    }),
    []
  )

  if (!snapshot) {
    return (
      <View style={styles.emptyPage}>
        <Text style={styles.emptyTitle}>Open this chat to see its artifacts</Text>
        <Text style={styles.emptyBody}>The list follows the chat that is on screen.</Text>
      </View>
    )
  }

  const others = filterRecordedFiles(files, 'files')
  const pageGroups = groupRecordedFilesByDay(pages, now)
  const showPages = filter !== 'files' && pages.length > 0
  const showFiles = filter !== 'pages' && others.length > 0

  return (
    <View ref={viewport} style={styles.viewport}>
      <ArtifactScrollScopeContext.Provider value={scope}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={120}
          onScroll={() => scrollListeners.current.forEach((listener) => listener())}
        >
          <View style={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((id) => (
              <FilterChip
                key={id}
                label={artifactFilterLabel(id)}
                count={countFor(id, pages.length, others.length)}
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
                    {group.files.map((page) => (
                      <PageTile
                        key={JSON.stringify(page.target)}
                        page={page}
                        source={snapshot.recordedSource}
                        onOpen={onOpenPage}
                      />
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

          {(filter === 'all' && pages.length + others.length === 0) ||
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
      </ArtifactScrollScopeContext.Provider>
    </View>
  )
}

function countFor(id: MobileRecordedFilterId, pages: number, others: number): number {
  if (id === 'pages') {
    return pages
  }
  return id === 'files' ? others : pages + others
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
  page,
  source,
  onOpen
}: {
  page: MobileArtifactPage
  source: MobileChatSurfaceRecordedSource | null
  onOpen: (target: MobileArtifactTarget) => void
}) {
  const { ref, near, onLayout } = useArtifactTileNearViewport()
  const [width, setWidth] = useState(0)
  const thumbnail = useArtifactThumbnail(page.target, source, near)
  const Glyph = page.kind === 'markdown' ? FileText : FileCode
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${page.name}`}
      onPress={() => onOpen(page.target)}
      style={styles.pageTile}
    >
      <View
        ref={ref}
        style={styles.pageArt}
        onLayout={(event: LayoutChangeEvent) => {
          setWidth(event.nativeEvent.layout.width)
          onLayout()
        }}
      >
        {thumbnail.kind === 'page' && width > 0 ? (
          <MobileArtifactPagePreview html={thumbnail.html} width={width} height={PAGE_ART_HEIGHT} />
        ) : (
          <>
            <Glyph size={26} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.kindChip}>{page.label}</Text>
          </>
        )}
      </View>
      <Text style={styles.pageName} numberOfLines={1}>
        {page.name}
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
