// The three messages a user sends about a design system: an edit, a re-detect and a palette choice.
// Each has the visible text the chat shows, and a hidden block, opened by its own marker, for the agent.
import { DESIGN_SYSTEM_FILES_LINE_PREFIX } from './prototype-design-system-files'
import type { DesignSystemDraftGroup } from './prototype-design-system-draft'
import {
  DESIGN_SYSTEM_CHAT_INSTRUCTION,
  DESIGN_SYSTEM_REDETECT_INSTRUCTION,
  designSystemFilesList,
  designSystemFormatInstruction
} from './prototype-design-system-instruction'
import {
  neutralizePrototypeMarkers,
  prototypeDesignSystemMarkerLine
} from './prototype-hidden-instruction'
import { DIRECTION_LETTER_PATTERN, prototypeFileName } from './prototype-request-folder'
import { joinFolderPath } from './prototype-request'

export type DesignSystemRebuildSet = {
  title: string
  /** The set's request folder on the host. */
  folderPath: string
  /** Each direction with the version the rebuild writes, from 2 on. */
  directions: readonly { letter: string; nextVersion: number }[]
}

export type DesignSystemUpdateInput = {
  /** The version the system is at now; the message asks for the next one. */
  currentVersion: number
  groups: readonly DesignSystemDraftGroup[]
  /** The sets to rebuild on the new version; none when the option is off. */
  rebuild: readonly DesignSystemRebuildSet[]
  freeText: string
  /** The system's absolute folder on the agent's host; absent, the message names project-relative paths. */
  systemFolder?: string
}

export type DesignSystemMessage = {
  /** What the chat shows. */
  visibleText: string
  /** What the agent receives, hidden block included. */
  sentText: string
}

const REDETECT_TEXT = 'Re-detect the design system from the project.'

// Why: a linked worktree's agent runs in a folder that does not hold the system, so it gets the absolute folder.
function filesLine(folder: string | undefined): string {
  const list = designSystemFilesList(folder)
  return `${DESIGN_SYSTEM_FILES_LINE_PREFIX} ${list}${folder === undefined ? ', relative to the project root.' : '.'}`
}

/** "Update the design system to v{n+1}." with the draft's groups, the rebuild line and the free text. */
export function buildDesignSystemUpdateMessage(
  input: DesignSystemUpdateInput
): DesignSystemMessage {
  const next = nextVersionOf(input.currentVersion)
  const lines = [`Update the design system to v${next}.`]
  for (const group of input.groups) {
    lines.push(group.title)
    for (const item of group.items) {
      lines.push(`  ${item.label}: ${singleLine(item.text)}`)
    }
  }
  if (input.rebuild.length > 0) {
    lines.push(
      `Rebuild ${input.rebuild.map((set) => singleLine(set.title)).join(', ')} on v${next}.`
    )
  }
  const freeText = input.freeText.trim()
  if (freeText.length > 0) {
    lines.push('', freeText)
  }
  const visibleText = neutralizePrototypeMarkers(lines.join('\n'))
  const hidden = [
    prototypeDesignSystemMarkerLine('update'),
    filesLine(input.systemFolder),
    `Apply the design system changes above to those files. Change nothing else: keep every other token, value and component exactly as it is. Set the version in tokens.json to ${next} and add a history entry for it with the system's status and today's date, keeping tokens.json valid and components.html in the format below.`,
    ...rebuildInstructionLines(input.rebuild, next),
    designSystemFormatInstruction(input.systemFolder)
  ]
  return { visibleText, sentText: `${visibleText}\n\n${hidden.join('\n')}` }
}

/** "Re-detect the design system from the project." with the re-detect instruction. */
export function buildDesignSystemRedetectMessage(
  input: { systemFolder?: string | undefined } = {}
): DesignSystemMessage {
  const hidden = [
    prototypeDesignSystemMarkerLine('detect'),
    filesLine(input.systemFolder),
    DESIGN_SYSTEM_REDETECT_INSTRUCTION,
    designSystemFormatInstruction(input.systemFolder)
  ]
  return { visibleText: REDETECT_TEXT, sentText: `${REDETECT_TEXT}\n\n${hidden.join('\n')}` }
}

// "design system" in English or Spanish, with the common "desing" typo; "system design" is another subject.
const DESIGN_SYSTEM_WORDING = [
  /\bdes(?:ign|ing)[\s_-]*systems?\b/iu,
  /\bsistemas?\s+de\s+dise[ñn]o\b/iu
]

/** Whether a chat message names a design system, so it carries the format MassOrca reads one in. */
export function asksForDesignSystem(text: string): boolean {
  return DESIGN_SYSTEM_WORDING.some((pattern) => pattern.test(text))
}

/**
 * A message typed in the chat that names the design system: the text as typed, and the files and their format
 * hidden behind it. Null for any other message, which goes as typed.
 */
export function buildDesignSystemChatMessage(input: {
  text: string
  /** The system's absolute folder on the agent's host; absent, the message names project-relative paths. */
  systemFolder?: string | undefined
}): DesignSystemMessage | null {
  const visibleText = neutralizePrototypeMarkers(input.text).trim()
  if (!asksForDesignSystem(visibleText)) {
    return null
  }
  const hidden = [
    prototypeDesignSystemMarkerLine('detect'),
    filesLine(input.systemFolder),
    DESIGN_SYSTEM_CHAT_INSTRUCTION,
    designSystemFormatInstruction(input.systemFolder)
  ]
  return { visibleText, sentText: `${visibleText}\n\n${hidden.join('\n')}` }
}

/** "Use the {name} palette for the design system." with the steps that apply it and unblock the pending request. */
export function buildDesignSystemPaletteApproveMessage(input: {
  paletteName: string
  /** The request that waits for the system. */
  requestId: string
  /** The system's absolute folder on the agent's host; absent, the message names project-relative paths. */
  systemFolder?: string
}): DesignSystemMessage {
  const name = singleLine(neutralizePrototypeMarkers(input.paletteName))
  const visibleText = `Use the ${name} palette for the design system.`
  const hidden = [
    prototypeDesignSystemMarkerLine('approve', input.requestId),
    filesLine(input.systemFolder),
    `Apply the palette named "${name}" from the palettes in tokens.json: copy its tokens into the token values, set the status to detected, and bump the version with a history entry. Change nothing else: keep every other token, value and component exactly as it is.`,
    `Then write the directions of prototype request ${input.requestId} as that request asked earlier in this chat, built only with the updated tokens and components.`,
    designSystemFormatInstruction(input.systemFolder)
  ]
  return { visibleText, sentText: `${visibleText}\n\n${hidden.join('\n')}` }
}

function rebuildInstructionLines(
  sets: readonly DesignSystemRebuildSet[],
  version: number
): string[] {
  return sets.flatMap((set) => [
    `Rebuild ${singleLine(neutralizePrototypeMarkers(set.title))} on v${version}: write the next version of each direction as a self-contained file with inline CSS and no external network resources, built only with the updated tokens and components, at these exact paths, and do not modify other files:`,
    ...set.directions.map(({ letter, nextVersion }) => {
      if (
        !DIRECTION_LETTER_PATTERN.test(letter) ||
        !Number.isSafeInteger(nextVersion) ||
        nextVersion < 2
      ) {
        throw new RangeError('A rebuild needs a direction letter and a version from 2 on')
      }
      return joinFolderPath(set.folderPath, prototypeFileName(letter, nextVersion))
    })
  ])
}

function nextVersionOf(currentVersion: number): number {
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 1) {
    throw new RangeError('A design system version starts at 1')
  }
  return currentVersion + 1
}

// Each item stays on one line, so a multi-line note cannot break the indented layout.
function singleLine(value: string): string {
  return value.replace(/\s*\n\s*/gu, ' ')
}
