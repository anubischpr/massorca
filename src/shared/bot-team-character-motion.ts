import type { BotTeamCharacter } from './rpc-contract/bot-team-params'

export type BotCharacterMove =
  | 'blink'
  | 'look'
  | 'hop'
  | 'happy'
  | 'breathe'
  | 'tilt'
  | 'cross'
  | 'doze'
  | 'shake'
  | 'attend'

export type BotCharacterEffect = 'rainbow' | 'electrons' | 'bands' | 'bolts' | 'sparkles' | 'dashes'

export type BotCharacterMotion = {
  /** Repeats make a move likelier: this is what sets a personality apart. */
  moves: readonly BotCharacterMove[]
  effect: BotCharacterEffect
  /** The effect's own tone, where the body's color would hide it. */
  effectColor?: string
}

/** One fixed personality per character. */
export const BOT_CHARACTER_MOTION: Record<BotTeamCharacter, BotCharacterMotion> = {
  // Curious
  square: {
    moves: ['look', 'look', 'tilt', 'blink', 'attend'],
    effect: 'electrons',
    effectColor: '#fde68a'
  },
  // Energetic
  circle: { moves: ['hop', 'hop', 'happy', 'blink', 'shake'], effect: 'rainbow' },
  // Calm
  triangle: {
    moves: ['breathe', 'breathe', 'blink', 'happy', 'doze'],
    effect: 'bands',
    effectColor: '#e9d5ff'
  },
  // Mischievous
  hexagon: { moves: ['cross', 'cross', 'look', 'happy', 'hop'], effect: 'bolts' },
  // Shy
  diamond: { moves: ['blink', 'blink', 'look', 'tilt', 'breathe'], effect: 'sparkles' },
  // Dreamy
  blob: {
    moves: ['doze', 'doze', 'breathe', 'look', 'blink'],
    effect: 'dashes',
    effectColor: '#10b981'
  }
}

export const BOT_CHARACTER_MOVE_MS: Record<BotCharacterMove, number> = {
  blink: 600,
  look: 1300,
  hop: 700,
  happy: 1300,
  breathe: 1400,
  tilt: 1300,
  cross: 1200,
  doze: 1450,
  shake: 600,
  attend: 1400
}

export const BOT_CHARACTER_IDLE_MIN_MS = 8000
export const BOT_CHARACTER_IDLE_MAX_MS = 30000
export const BOT_CHARACTER_ORBIT_ANGLES = [-22, 38, 98] as const
/** Below this an orbit around the icon reads as noise, so working is a plain aura. */
export const BOT_CHARACTER_MIN_EFFECT_SIZE = 24

/** A working bot never dozes. */
export function pickBotCharacterMove(
  character: BotTeamCharacter,
  working: boolean,
  random: number
): BotCharacterMove {
  const { moves } = BOT_CHARACTER_MOTION[character]
  const pool = working ? moves.filter((move) => move !== 'doze') : moves
  return pool[Math.min(Math.floor(random * pool.length), pool.length - 1)]
}

/** The effect a state shows: lost contact shows none, because it is neither working nor stopped. */
export function botCharacterEffect(args: {
  character: BotTeamCharacter
  working: boolean
  unreachable: boolean
  animated: boolean
  size: number
}): BotCharacterEffect | 'aura' | null {
  if (!args.working || args.unreachable) {
    return null
  }
  return !args.animated || args.size < BOT_CHARACTER_MIN_EFFECT_SIZE
    ? 'aura'
    : BOT_CHARACTER_MOTION[args.character].effect
}
