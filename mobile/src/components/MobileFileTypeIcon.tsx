import {
  Database,
  File,
  FileArchive,
  FileAxis3d,
  FileBox,
  FileBraces,
  FileChartColumn,
  FileCode,
  FileCog,
  FileDiff,
  FileImage,
  FileJson,
  FileKey,
  FileLock,
  FileMusic,
  FileSliders,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType,
  FileVideo,
  Smartphone
} from 'lucide-react-native'
import { fileTypeIconName, type FileTypeIconName } from '../../../src/shared/file-type-icon-name'
import { colors } from '../theme/mobile-theme'

type GlyphProps = { size: number; color: string; strokeWidth: number }

// Why: each case reads only the one glyph a file needs, so no other lucide export is touched on render.
function fileTypeGlyph(name: FileTypeIconName, props: GlyphProps) {
  switch (name) {
    case 'Database':
      return <Database {...props} />
    case 'File':
      return <File {...props} />
    case 'FileArchive':
      return <FileArchive {...props} />
    case 'FileAxis3D':
      return <FileAxis3d {...props} />
    case 'FileBox':
      return <FileBox {...props} />
    case 'FileBraces':
      return <FileBraces {...props} />
    case 'FileChartColumn':
      return <FileChartColumn {...props} />
    case 'FileCode':
      return <FileCode {...props} />
    case 'FileCog':
      return <FileCog {...props} />
    case 'FileDiff':
      return <FileDiff {...props} />
    case 'FileImage':
      return <FileImage {...props} />
    case 'FileJson':
      return <FileJson {...props} />
    case 'FileKey':
      return <FileKey {...props} />
    case 'FileLock':
      return <FileLock {...props} />
    case 'FileMusic':
      return <FileMusic {...props} />
    case 'FileSliders':
      return <FileSliders {...props} />
    case 'FileSpreadsheet':
      return <FileSpreadsheet {...props} />
    case 'FileTerminal':
      return <FileTerminal {...props} />
    case 'FileText':
      return <FileText {...props} />
    case 'FileType':
      return <FileType {...props} />
    case 'FileVideo':
      return <FileVideo {...props} />
    case 'Smartphone':
      return <Smartphone {...props} />
  }
}

/** The icon a file's type shows, the same glyph the desktop draws for it. */
export function MobileFileTypeIcon({
  path,
  size = 14,
  color = colors.textSecondary
}: {
  path: string | undefined | null
  size?: number
  color?: string
}) {
  return fileTypeGlyph(fileTypeIconName(path), { size, color, strokeWidth: 2 })
}
