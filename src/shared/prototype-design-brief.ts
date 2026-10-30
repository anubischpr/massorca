// The craft rules every agent receives with a prototype request, in plain text so any agent reads
// them the same way. The floors come from what real directions got wrong: sideways scroll on a
// phone, body text under 12px, half-empty desktop frames and one look across every direction.
import { PROTOTYPE_FRAMES } from './prototype-frames'

const { desktop, phone } = PROTOTYPE_FRAMES

/** The sizes MassOrca shows a page at, and what each must hold. */
export const PROTOTYPE_FRAMES_LINE = `Frames: MassOrca shows this one file at exactly ${desktop.width}x${desktop.height} (desktop) and ${phone.width}x${phone.height} (phone), and both must look finished. Add the viewport meta tag. No sideways scroll at either size. Use the desktop width on purpose and fill the first screen, without a blank lower half or a thin centered column. On the phone, recompose instead of shrinking: one column, side panels moved into the flow, tables as stacked rows, the main decision high enough to find, no fixed bar covering content, every control at least 44px tall.`

const CRAFT_LINES: readonly string[] = [
  'Design brief, for work a senior product designer would sign:',
  "Subject: name the audience and their one main task, then give that task the first screen and the most visual weight. Use real content from the project, or realistic names, numbers and copy from the user's domain; never lorem ipsum. Write labels and buttons in the language of the request, naming what they do.",
  PROTOTYPE_FRAMES_LINE,
  'Type: choose a font stack for this subject from fonts common on desktop and phone, with fallbacks, not plain system-ui, and load no remote fonts. Use at most 5 sizes from one scale, such as 13/15/18/24/36, with a page title clearly the largest thing on screen. Body text 15px or more, 16px on the phone, and nothing under 13px. Keep lines under 80 characters. Build hierarchy from size and weight before color.',
  'Space: use multiples of 4 (8, 12, 16, 24, 32, 48, 64). Related things sit close and sections sit far apart. Align everything to one grid.',
  'Color: a neutral base, one accent used for the main action and current state, and status colors only for real status. Prefer flat, considered surfaces.',
  'Avoid the defaults of generated UI: a purple or blue gradient on white, decorative gradients and glows, rows of identical rounded cards with the same shadow, a colored pill on every value, tracked uppercase labels above every section, a monospace face for ordinary data, numbered markers on things that are not a sequence, and emoji as icons.',
  'Project look: when the project has a design system, theme or tokens, read them first and use them; they override the type and color choices above, though never the frames or the accessibility floor. Designing for an existing product, keep its identity unless the user asks for a new one.',
  'Accessibility: semantic landmarks and headings, real buttons and labelled inputs, WCAG AA contrast, visible keyboard focus, and motion only when it explains a change, respecting prefers-reduced-motion.',
  `Before replying, check both frames, in a headless browser if you have one, and fix any overflow, clipped text or empty area.`
]

const DIRECTIONS_LINE =
  'Directions: each must be a different answer, differing in structure, in what it puts first and in visual language, so that a viewer could not mistake one for a recolor of another. Decide each one in a sentence before writing it.'

/** The brief a new request carries; a single direction has nothing to differ from. */
export function prototypeDesignBrief(directions: number): string {
  const [opening, ...rest] = CRAFT_LINES
  return (directions > 1 ? [opening, DIRECTIONS_LINE, ...rest] : CRAFT_LINES).join('\n')
}

/** What a new version or a merged direction must keep, without repeating the whole brief. */
export const PROTOTYPE_VERSION_CRAFT_LINE = `Keep it finished at ${desktop.width}x${desktop.height} and ${phone.width}x${phone.height} with no sideways scroll, body text 15px or more, nothing under 13px, phone controls at least 44px tall, and spacing in multiples of 4. Follow the project's design system or tokens when it has them.`
