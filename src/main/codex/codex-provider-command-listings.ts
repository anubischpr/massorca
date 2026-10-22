import { readRecord, readString } from './codex-item-field-readers'

const MAX_LISTED = 80
const MAX_DESCRIPTION_CHARS = 110

function oneLine(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > MAX_DESCRIPTION_CHARS ? `${line.slice(0, MAX_DESCRIPTION_CHARS - 1)}…` : line
}

function listing(title: string, rows: readonly [name: string, description: string][]): string {
  if (rows.length === 0) {
    return `${title}: none.`
  }
  const width = Math.min(Math.max(...rows.map(([name]) => name.length)), 36)
  const shown = rows
    .slice(0, MAX_LISTED)
    .map(([name, description]) => (description ? `${name.padEnd(width)}  ${description}` : name))
  const more = rows.length > MAX_LISTED ? [`… and ${rows.length - MAX_LISTED} more`] : []
  return [`${title} (${rows.length})`, ...shown, ...more].join('\n')
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** `skills/list`: one row per skill, enabled first; a disabled skill says so. */
export function codexSkillsListing(response: unknown): string {
  const rows: [string, string, boolean][] = []
  for (const entry of array(readRecord(response).data)) {
    for (const skill of array(readRecord(entry).skills)) {
      const record = readRecord(skill)
      const name = readString(record, 'name')
      if (name === null) {
        continue
      }
      const described =
        readString(readRecord(record.interface), 'shortDescription') ??
        readString(record, 'shortDescription') ??
        readString(record, 'description') ??
        ''
      rows.push([name, oneLine(described), record.enabled !== false])
    }
  }
  rows.sort((left, right) => Number(right[2]) - Number(left[2]) || left[0].localeCompare(right[0]))
  return listing(
    'Skills',
    rows.map(([name, description, enabled]) => [
      name,
      enabled ? description : `(disabled) ${description}`
    ])
  )
}

/** `plugin/list`: the installed plugins with their state, then how many more the marketplaces offer. */
export function codexPluginsListing(response: unknown): string {
  const installed: [string, string][] = []
  let available = 0
  for (const marketplace of array(readRecord(response).marketplaces)) {
    for (const plugin of array(readRecord(marketplace).plugins)) {
      const record = readRecord(plugin)
      const display = readString(readRecord(record.interface), 'displayName')
      const name = display ?? readString(record, 'name')
      if (name === null) {
        continue
      }
      if (record.installed !== true) {
        available += 1
        continue
      }
      const described = readString(readRecord(record.interface), 'shortDescription') ?? ''
      installed.push([
        name,
        `${record.enabled === false ? '(disabled) ' : ''}${oneLine(described)}`.trim()
      ])
    }
  }
  installed.sort((left, right) => left[0].localeCompare(right[0]))
  const text = listing('Installed plugins', installed)
  return available > 0 ? `${text}\n${available} more available to install in Codex.` : text
}
