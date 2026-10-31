// Orca mobile design tokens — matches desktop graphite/dark palette.
// All screen files should import from here instead of using inline hex values.

export const colors = {
  bgBase: '#111111',
  bgPanel: '#1a1a1a',
  bgRaised: '#242424',
  borderSubtle: '#2a2a2a',
  editorSurface: '#1e1e1e',

  textPrimary: '#e0e0e0',
  textSecondary: '#a1a1a1',
  textMuted: '#8c8c8c',

  // Crisp near-white surface for the single primary action on a screen (the
  // worktree FAB). Brighter than textPrimary so it reads as a solid button, not
  // disabled chrome, while staying monochrome (STYLEGUIDE: color is for state).
  surfaceBright: '#f5f5f5',

  accentBlue: '#3b82f6',
  // Soft wash behind a control a draft item jumped to, the same hue as accentBlue.
  accentBlueTint: 'rgba(59, 130, 246, 0.08)',
  // Dark wash behind a control laid over a prototype tile, so it reads on a white page.
  scrimOverTile: 'rgba(17, 17, 17, 0.78)',
  // Text/icon color on a filled accent (accentBlue) button, where the muted
  // textPrimary would lack contrast against the saturated fill.
  onAccent: '#ffffff',

  statusGreen: '#22c55e',
  statusAmber: '#f59e0b',
  // Outline of the Prototypes "Merge" button, the same hue as statusAmber.
  statusAmberBorder: 'rgba(245, 158, 11, 0.5)',
  statusRed: '#ef4444',
  // Needs-human mark (blocked, waiting, a permission prompt): the desktop dark-mode --agent-question
  // token, Tailwind orange-500 (oklch 70.5% 0.213 47.6), as its sRGB approximation. Light mode is
  // orange-600 (#f54900). Red is reserved for failures.
  statusOrange: '#ff6900',
  // Outline of a destructive sheet action, the same hue as statusRed.
  statusRedBorder: 'rgba(239, 68, 68, 0.5)',
  // Full-access wash behind the red access lock, same rgba form as the diff tints below.
  statusRedTint: 'rgba(239, 68, 68, 0.14)',
  // Merge CTA fill + its on-fill text, mirroring the desktop ChecksPanel's
  // bg-green-600 "Squash and merge" button (green-600 / white).
  mergeGreen: '#16a34a',
  onMergeGreen: '#ffffff',
  // Merged-PR purple, mirroring the desktop ReviewIcon's purple-400/70 tone.
  statusPurple: '#a78bfa',
  gitDecorationAdded: '#81b88b',
  gitDecorationDeleted: '#c74e39',
  diffAddedBg: 'rgba(129, 184, 139, 0.1)',
  diffDeletedBg: 'rgba(199, 78, 57, 0.11)',

  syntaxComment: '#6a9955',
  syntaxKeyword: '#569cd6',
  syntaxString: '#ce9178',
  syntaxNumber: '#b5cea8',
  syntaxType: '#4ec9b0',
  syntaxFunction: '#dcdcaa',
  syntaxVariable: '#9cdcfe',
  syntaxMeta: '#c586c0',

  // Terminal WebView background (Tokyonight) — separate from app chrome
  terminalBg: '#1a1b26'
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24
} as const

export const radii = {
  row: 6,
  card: 14,
  button: 6,
  input: 6,
  camera: 8
} as const

export const typography = {
  titleSize: 18,
  bodySize: 14,
  metaSize: 12,
  monoFamily: 'monospace' as const
} as const
