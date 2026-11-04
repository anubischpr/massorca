// Edits one member of a JSON object in place, so every other byte of the file (indent, CRLF,
// final newline, key order, number spelling) stays exactly as the user or the agent wrote it.

type JsonMember = {
  key: string
  /** Start of the whitespace that precedes the key. */
  leadStart: number
  keyStart: number
  keyEnd: number
  valueStart: number
  valueEnd: number
}

type JsonObjectSpan = { open: number; close: number; members: JsonMember[] }

function skipWhitespace(text: string, from: number): number {
  let index = from
  while (index < text.length && ' \t\r\n'.includes(text.charAt(index))) {
    index++
  }
  return index
}

function skipString(text: string, from: number): number {
  let index = from + 1
  while (text.charAt(index) !== '"') {
    index += text.charAt(index) === '\\' ? 2 : 1
  }
  return index + 1
}

function skipValue(text: string, from: number): number {
  const first = text.charAt(from)
  if (first === '"') {
    return skipString(text, from)
  }
  if (first === '{' || first === '[') {
    let depth = 0
    let index = from
    while (index < text.length) {
      const char = text.charAt(index)
      if (char === '"') {
        index = skipString(text, index)
        continue
      }
      depth += char === '{' || char === '[' ? 1 : 0
      depth -= char === '}' || char === ']' ? 1 : 0
      index++
      if (depth === 0) {
        return index
      }
    }
    return index
  }
  let index = from
  while (index < text.length && !',}] \t\r\n'.includes(text.charAt(index))) {
    index++
  }
  return index
}

// Why: callers parse the text with JSON.parse first, so this scanner only ever sees valid JSON.
function scanObject(text: string, open: number): JsonObjectSpan {
  const members: JsonMember[] = []
  let index = open + 1
  while (true) {
    const keyStart = skipWhitespace(text, index)
    if (text.charAt(keyStart) === '}') {
      return { open, close: keyStart, members }
    }
    const keyEnd = skipString(text, keyStart)
    const valueStart = skipWhitespace(text, text.indexOf(':', keyEnd) + 1)
    const valueEnd = skipValue(text, valueStart)
    members.push({
      key: String(JSON.parse(text.slice(keyStart, keyEnd))),
      leadStart: index,
      keyStart,
      keyEnd,
      valueStart,
      valueEnd
    })
    const after = skipWhitespace(text, valueEnd)
    if (text.charAt(after) === '}') {
      return { open, close: after, members }
    }
    index = after + 1
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return isPlainObject(value) ? value : null
  } catch {
    return null
  }
}

type Layout = { eol: string; unit: string; compact: boolean }

function detectLayout(text: string, root: JsonObjectSpan): Layout {
  const first = root.members[0]
  const lead = first ? text.slice(first.leadStart, first.keyStart) : ''
  const indent = lead.slice(lead.lastIndexOf('\n') + 1)
  return {
    eol: text.includes('\r\n') ? '\r\n' : '\n',
    unit: /^( +|\t+)$/.test(indent) ? indent : '  ',
    compact: !text.includes('\n')
  }
}

function lineIndent(text: string, position: number): string {
  const lineStart = text.lastIndexOf('\n', position - 1) + 1
  return /^[ \t]*/.exec(text.slice(lineStart, position))?.[0] ?? ''
}

function renderValue(value: unknown, layout: Layout, baseIndent: string): string {
  if (layout.compact) {
    return JSON.stringify(value)
  }
  return JSON.stringify(value, null, layout.unit).replaceAll('\n', `${layout.eol}${baseIndent}`)
}

function insertMember(
  text: string,
  object: JsonObjectSpan,
  layout: Layout,
  key: string,
  value: unknown
): string {
  const last = object.members.at(-1)
  if (last) {
    const lead = text.slice(last.leadStart, last.keyStart)
    const colon = text.slice(last.keyEnd, last.valueStart)
    const member = `${JSON.stringify(key)}${colon}${renderValue(value, layout, lead.slice(lead.lastIndexOf('\n') + 1))}`
    return `${text.slice(0, last.valueEnd)},${lead}${member}${text.slice(last.valueEnd)}`
  }
  if (layout.compact) {
    const member = `${JSON.stringify(key)}:${renderValue(value, layout, '')}`
    return `${text.slice(0, object.open + 1)}${member}${text.slice(object.close)}`
  }
  const closeIndent = lineIndent(text, object.open)
  const memberIndent = `${closeIndent}${layout.unit}`
  const member = `${JSON.stringify(key)}: ${renderValue(value, layout, memberIndent)}`
  return `${text.slice(0, object.open + 1)}${layout.eol}${memberIndent}${member}${layout.eol}${closeIndent}${text.slice(object.close)}`
}

function removeMember(text: string, object: JsonObjectSpan, key: string): string {
  const index = object.members.findIndex((member) => member.key === key)
  const member = object.members[index]
  if (!member) {
    return text
  }
  if (object.members.length === 1) {
    return `${text.slice(0, object.open + 1)}${text.slice(object.close)}`
  }
  const previous = object.members[index - 1]
  const next = object.members[index + 1]
  if (!next && previous) {
    return `${text.slice(0, previous.valueEnd)}${text.slice(member.valueEnd)}`
  }
  return `${text.slice(0, member.keyStart)}${text.slice(next ? next.keyStart : member.valueEnd)}`
}

function replaceMember(text: string, member: JsonMember, layout: Layout, value: unknown): string {
  const lead = text.slice(member.leadStart, member.keyStart)
  const rendered = renderValue(value, layout, lead.slice(lead.lastIndexOf('\n') + 1))
  return `${text.slice(0, member.valueStart)}${rendered}${text.slice(member.valueEnd)}`
}

function objectStart(text: string): number {
  return skipWhitespace(text, 0)
}

function newFile(container: string, name: string, value: unknown): string {
  return `${JSON.stringify({ [container]: { [name]: value } }, null, 2)}\n`
}

/**
 * Sets (value given) or removes (`undefined`) `root[container][name]`, touching nothing else.
 * Returns the same text when nothing changes and null when the shape is not an object holding an
 * object (or when a key repeats, which no parser agrees on).
 */
export function editJsonContainerMember(
  text: string | null,
  container: string,
  name: string,
  value: unknown
): string | null {
  if (text === null || text.trim() === '') {
    return value === undefined ? (text ?? '') : newFile(container, name, value)
  }
  const parsed = parseJsonObject(text)
  const servers = parsed?.[container]
  if (!parsed || (servers !== undefined && !isPlainObject(servers))) {
    return null
  }
  const root = scanObject(text, objectStart(text))
  const layout = detectLayout(text, root)
  const holder = root.members.filter((member) => member.key === container)
  if (holder.length > 1) {
    return null
  }
  const holderMember = holder[0]
  if (!holderMember) {
    return value === undefined
      ? text
      : insertMember(text, root, layout, container, { [name]: value })
  }
  const object = scanObject(text, holderMember.valueStart)
  const existing = object.members.filter((member) => member.key === name)
  if (existing.length > 1) {
    return null
  }
  const current = existing[0]
  if (value === undefined) {
    return current ? removeMember(text, object, name) : text
  }
  if (!current) {
    return insertMember(text, object, layout, name, value)
  }
  const same = JSON.stringify(servers?.[name]) === JSON.stringify(value)
  return same ? text : replaceMember(text, current, layout, value)
}
