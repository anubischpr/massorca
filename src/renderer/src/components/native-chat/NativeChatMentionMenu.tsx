import { memo, useEffect, useRef } from 'react'
import { Folder, Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { FilenameFirstPath } from '@/components/file-path-cursor-tooltip'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { MarketplaceAppMentionRow } from '../marketplace/MarketplaceAppMentionRow'
import {
  PickerHeading,
  PickerListbox,
  PickerOptionButton,
  PickerStatus
} from './NativeChatAutocompleteMenus'
import type { NativeChatMentionFiles } from './use-native-chat-mention-files'

/** The @ menu: the files that match, then any offered projects and the connected apps, headed when mixed. */
export const NativeChatMentionMenu = memo(function NativeChatMentionMenu({
  mention,
  activeIndex,
  listboxId,
  placement,
  onChoose
}: {
  mention: NativeChatMentionFiles
  activeIndex: number
  listboxId: string
  placement?: 'above' | 'below'
  onChoose: (path: string) => void
}): React.JSX.Element {
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  const apps = mention.apps ?? []
  const projects = mention.projects ?? []
  const files = mention.files.slice(0, mention.files.length - projects.length - apps.length)
  const selectedIndex = Math.min(activeIndex, mention.files.length - 1)
  const mixed = [files, projects, apps].filter((group) => group.length > 0).length > 1

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, mention.files])

  const statusText =
    files.length > 0 || (projects.length + apps.length > 0 && !mention.loading)
      ? null
      : mention.loading
        ? translate('components.native-chat.composer.loadingFiles', 'Loading files...')
        : mention.failed
          ? translate('components.native-chat.composer.filesLoadFailed', "Couldn't load files")
          : translate('components.native-chat.composer.noFiles', 'No matching files')

  return (
    <PickerListbox id={listboxId} placement={placement}>
      {mixed && files.length > 0 ? (
        <PickerHeading>
          {translate('components.native-chat.composer.mentionFiles', 'Files')}
        </PickerHeading>
      ) : null}
      {files.map((path, index) => {
        const FileIcon = getFileTypeIcon(path)
        return (
          <PickerOptionButton
            key={path}
            id={`${listboxId}-option-${index}`}
            selected={index === selectedIndex}
            activeItemRef={activeItemRef}
            onChoose={() => onChoose(path)}
            filePath={path}
          >
            <FileIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <FilenameFirstPath path={path} />
          </PickerOptionButton>
        )
      })}
      {mixed && projects.length > 0 ? (
        <PickerHeading>
          {translate('components.native-chat.composer.mentionProjects', 'Projects')}
        </PickerHeading>
      ) : null}
      {projects.map((project, offset) => {
        const index = files.length + offset
        return (
          <PickerOptionButton
            key={`project:${project.path}`}
            id={`${listboxId}-option-${index}`}
            selected={index === selectedIndex}
            activeItemRef={activeItemRef}
            onChoose={() => onChoose(project.path)}
            filePath={project.path}
          >
            <Folder className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{project.name}</span>
          </PickerOptionButton>
        )
      })}
      {mixed && apps.length > 0 ? (
        <PickerHeading>
          {translate('components.native-chat.composer.mentionApps', 'Apps')}
        </PickerHeading>
      ) : null}
      {apps.map((app, offset) => {
        const index = files.length + projects.length + offset
        return (
          <PickerOptionButton
            key={`app:${app.id}`}
            id={`${listboxId}-option-${index}`}
            selected={index === selectedIndex}
            activeItemRef={activeItemRef}
            onChoose={() => onChoose(app.name)}
          >
            <MarketplaceAppMentionRow app={app} />
          </PickerOptionButton>
        )
      })}
      {statusText ? (
        <PickerStatus>
          {mention.loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {statusText}
        </PickerStatus>
      ) : null}
      <div aria-live="polite" className="sr-only">
        {statusText ?? ''}
      </div>
    </PickerListbox>
  )
})
