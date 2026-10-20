import { editFilesFromToolPair, editLanded } from './native-chat-edit-normalize'

/** Antigravity names the mutated file in its input and carries no content, so these tools can
 *  report which file changed but not how. `Path` is the observed key (`write_file`, `edit_file`);
 *  `TargetFile` is the one its other file steps use (`write_to_file`, `replace_file_content`). */
const PATH_ONLY_MUTATION_TOOLS = new Set([
  'write_file',
  'edit_file',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content'
])
const PATH_ONLY_KEYS = ['Path', 'TargetFile', 'file_path', 'filePath', 'path']

/** Every file a landed call changed. Falls back to the path a content-less file tool names, so a
 *  results list can show the file even where no diff can be drawn. */
export function editedPathsFromToolPair(pair: Parameters<typeof editFilesFromToolPair>[0]): string[] {
  const files = editFilesFromToolPair(pair)
  if (files) {
    return files.map((file) => file.path)
  }
  const input = typeof pair.input === 'object' && pair.input !== null ? pair.input : null
  if (!input || !PATH_ONLY_MUTATION_TOOLS.has(pair.name) || !editLanded(pair)) {
    return []
  }
  const fields: Record<string, unknown> = { ...input }
  const path = PATH_ONLY_KEYS.map((key) => fields[key]).find(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
  return path ? [path] : []
}
