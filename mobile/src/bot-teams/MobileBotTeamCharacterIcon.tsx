import Svg, { Path } from 'react-native-svg'
import {
  BOT_TEAM_CHARACTER_ART,
  BOT_TEAM_EYE_COLOR,
  BOT_TEAM_EYE_PATH,
  botEyeTransform
} from '../../../src/shared/bot-team-character-art'
import type { BotTeamCharacter } from '../../../src/shared/rpc-contract/bot-team-params'

export function MobileBotTeamCharacterIcon({
  character,
  size
}: {
  character: BotTeamCharacter
  size: number
}) {
  const art = BOT_TEAM_CHARACTER_ART[character]
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d={art.body}
        fill={art.color}
        stroke={art.roundedStroke ? art.color : undefined}
        strokeWidth={art.roundedStroke ? 8 : undefined}
        strokeLinejoin="round"
      />
      {art.eyes.map((placement) => (
        <Path
          key={botEyeTransform(placement)}
          d={BOT_TEAM_EYE_PATH}
          transform={botEyeTransform(placement)}
          fill={BOT_TEAM_EYE_COLOR}
        />
      ))}
    </Svg>
  )
}
