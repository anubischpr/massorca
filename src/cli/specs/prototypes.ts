import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const PROTOTYPE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['prototypes', 'design-system'],
    summary: "Check whether a chat's design system is readable by MassOrca, and why not",
    usage: 'orca prototypes design-system --session <sessionId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session'],
    notes: [
      'MassOrca reads a project design system only from design/system/tokens.json, components.html and system.md. A valid tokens.json makes it readable; the other two are optional.',
      'Prints readable or not readable, then the folder MassOrca reads, the version, the files read, and one line per reason. Other files in design/system are named, not read.',
      'Exits 1 when the design system is not readable or the chat is not found on this host; exits 0 when it is readable.',
      'Changes no project file. It may keep a copy of the current version in MassOrca state.'
    ],
    examples: [
      'orca prototypes design-system --session <sessionId>',
      'orca prototypes design-system --session <sessionId> --json'
    ]
  }
]
