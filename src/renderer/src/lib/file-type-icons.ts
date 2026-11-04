import {
  Database,
  File,
  FileArchive,
  FileAxis3D,
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
  Smartphone,
  type LucideIcon
} from 'lucide-react'
import { fileTypeIconName, type FileTypeIconName } from '../../../shared/file-type-icon-name'

const FILE_TYPE_ICONS: Record<FileTypeIconName, LucideIcon> = {
  Database,
  File,
  FileArchive,
  FileAxis3D,
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
}

export function getFileTypeIcon(filePath: string | undefined | null): LucideIcon {
  return FILE_TYPE_ICONS[fileTypeIconName(filePath)]
}
