// The Gentle Shell design/<slug>/ folders a prototype request is bound to. The Prototypes view owns
// their files, so a chat's Artifacts list leaves them out.
import type { PrototypeListedSet } from './rpc-contract/prototype-params'

const GENTLE_DESIGN_FOLDER = 'design'

/** The `design/<slug>` folder a Gentle Shell set reads its artboards from, or null for any other set. */
export function boundDesignFolderOf(set: PrototypeListedSet): string | null {
  if (set.agent !== 'gentle-shell') {
    return null
  }
  const fileName = set.directions[0]?.versions[0]?.fileName
  if (fileName === undefined) {
    return null
  }
  const [folder, slug] = fileName.replaceAll('\\', '/').split('/')
  return folder === GENTLE_DESIGN_FOLDER && slug !== undefined && slug.length > 0
    ? `${GENTLE_DESIGN_FOLDER}/${slug}`
    : null
}

/** True when a visual's file lies under one of the bound design folders, relative or absolute. */
export function isBoundDesignFile(file: string, folders: readonly string[]): boolean {
  const path = `/${file.replaceAll('\\', '/').replace(/^\.\//u, '')}`
  return folders.some((folder) => path.includes(`/${folder}/`))
}
