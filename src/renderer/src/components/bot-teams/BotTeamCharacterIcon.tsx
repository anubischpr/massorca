import {
  BOT_TEAM_CHARACTER_ART,
  BOT_TEAM_EYE_COLOR,
  BOT_TEAM_EYE_PATH,
  botEyeTransform
} from '../../../../shared/bot-team-character-art'
import type { BotTeamCharacter } from '../../../../shared/rpc-contract/bot-team-params'

export function BotTeamCharacterIcon({
  character,
  size
}: {
  character: BotTeamCharacter
  size: number
}): React.JSX.Element {
  const art = BOT_TEAM_CHARACTER_ART[character]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <path
        d={art.body}
        fill={art.color}
        stroke={art.roundedStroke ? art.color : undefined}
        strokeWidth={art.roundedStroke ? 8 : undefined}
        strokeLinejoin="round"
      />
      {art.eyes.map((placement) => (
        <path
          key={botEyeTransform(placement)}
          d={BOT_TEAM_EYE_PATH}
          transform={botEyeTransform(placement)}
          fill={BOT_TEAM_EYE_COLOR}
        />
      ))}
    </svg>
  )
}
