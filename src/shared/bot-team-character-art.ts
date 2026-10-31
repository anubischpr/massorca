import type { BotTeamCharacter } from './rpc-contract/bot-team-params'

/** A single eye around the origin; each character places two with its own uneven transforms. */
export const BOT_TEAM_EYE_PATH =
  'M0-5C2.6-5.2 3.6-2.4 3.2.6C2.9 3.6 1.4 5-.4 4.8C-2.6 4.6-3.6 2.2-3.2-.8C-2.9-3.4-1.8-4.9 0-5Z'
export const BOT_TEAM_EYE_COLOR = '#111111'

type BotEyePlacement = { x: number; y: number; rotate: number; scaleX: number; scaleY: number }

export type BotTeamCharacterArt = {
  color: string
  body: string
  /** Rounds the corners of an angular body by stroking it in its own color. */
  roundedStroke: boolean
  eyes: readonly [BotEyePlacement, BotEyePlacement]
}

function eye(
  x: number,
  y: number,
  rotate: number,
  scaleX: number,
  scaleY: number
): BotEyePlacement {
  return { x, y, rotate, scaleX, scaleY }
}

export const BOT_TEAM_CHARACTER_ART: Record<BotTeamCharacter, BotTeamCharacterArt> = {
  square: {
    color: '#f59e0b',
    body: 'M22 8H42A14 14 0 0 1 56 22V42A14 14 0 0 1 42 56H22A14 14 0 0 1 8 42V22A14 14 0 0 1 22 8Z',
    roundedStroke: false,
    eyes: [eye(23, 29, -8, 1.25, 1.05), eye(41, 28, 10, 0.85, 1.2)]
  },
  circle: {
    color: '#38bdf8',
    body: 'M32 8A24 24 0 1 1 32 56A24 24 0 1 1 32 8Z',
    roundedStroke: false,
    eyes: [eye(24, 29, 6, 0.85, 1.15), eye(41, 31, -14, 1.15, 0.8)]
  },
  triangle: {
    color: '#a78bfa',
    body: 'M32 12L53 48H11Z',
    roundedStroke: true,
    eyes: [eye(25, 37, -12, 0.95, 0.85), eye(39, 38, 12, 0.7, 1)]
  },
  hexagon: {
    color: '#34d399',
    body: 'M32 9L53 21V43L32 55L11 43V21Z',
    roundedStroke: true,
    eyes: [eye(23, 30, 10, 1.15, 0.95), eye(41, 31, -6, 0.8, 1.1)]
  },
  diamond: {
    color: '#f472b6',
    body: 'M32 10L54 32L32 54L10 32Z',
    roundedStroke: true,
    eyes: [eye(26, 29, -10, 0.75, 1.05), eye(38, 31, 16, 1, 0.75)]
  },
  blob: {
    color: '#a3e635',
    body: 'M32 8C48 8 56 18 56 32C56 48 46 56 32 56C18 56 8 48 8 34C8 18 18 8 32 8Z',
    roundedStroke: false,
    eyes: [eye(24, 30, -5, 0.9, 1.2), eye(41, 29, 12, 1.2, 0.85)]
  }
}

export function botEyeTransform(placement: BotEyePlacement): string {
  const { x, y, rotate, scaleX, scaleY } = placement
  return `translate(${x} ${y}) rotate(${rotate}) scale(${scaleX} ${scaleY})`
}

/** The engines a bot can run on, in the order the Add a bot form lists them. */
export const BOT_AGENT_CHOICES = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'antigravity', label: 'Antigravity' },
  { id: 'pi', label: 'Gentle Shell' }
] as const

export type BotAgentId = (typeof BOT_AGENT_CHOICES)[number]['id']

export function botAgentLabel(agent: string): string {
  return BOT_AGENT_CHOICES.find((choice) => choice.id === agent)?.label ?? agent
}
