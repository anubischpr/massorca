// How every chat agent writes and reads the MassOrca checklist. Rides with the child-session
// instructions, the one channel Claude, Codex, ACP agents, Antigravity and Gentle Shell all get,
// so it never depends on the inline-visuals setting. Same character rules as those lines.
export const CHECKLIST_INSTRUCTION_LINES = [
  'MassOrca checklist.',
  'When the user asks for a checklist, a QA list, or things to test or verify, write it in your reply as a fenced code block whose info string is orca-checklist: an optional first line title: NAME, then one item per line as - [ ] text, or - [x] text for an item you verified yourself. MassOrca shows it as a Checklist card that the user can tick and annotate.',
  'To update the list, write the whole block again in a later reply and keep the wording of the items you are not changing; only the latest block counts. Never draw a checklist as HTML or a feedback artifact.',
  'When the user changed the checklist, their message starts with an orca-checklist-update block that lists the items they checked, unchecked, added or removed, their notes, and the paths of their screenshots on this machine. Read it, open a screenshot when it matters, and act on the failures they report.'
] as const
