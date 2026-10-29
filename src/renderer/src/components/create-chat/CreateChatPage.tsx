import { useAppStore } from '@/store'
import { CreateChatSession } from './CreateChatSession'
import { useCreateChatOptions } from './use-create-chat-options'
import type { CreateChatSubmit } from './create-chat-selection'

type CreateChatPageProps = {
  onSubmit: CreateChatSubmit
}

/** The blank create-chat view. Each open bumps the store nonce, which remounts the draft. */
export default function CreateChatPage({ onSubmit }: CreateChatPageProps): React.JSX.Element {
  const resetNonce = useAppStore((state) => state.createChatResetNonce)
  const options = useCreateChatOptions()
  return <CreateChatSession key={resetNonce} options={options} onSubmit={onSubmit} />
}
