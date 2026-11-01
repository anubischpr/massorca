import { translate } from '@/i18n/i18n'
import { CreateChatSession } from '../create-chat/CreateChatSession'
import { submitCreateChatDraft } from '../create-chat/create-chat-submit'
import { useCreateChatOptions } from '../create-chat/use-create-chat-options'
import { TasksHomeApprovals } from './TasksHomeApprovals'

/** The rail's Tasks page: the + Create composer, then the sessions that need the user. */
export default function TasksHomePage(): React.JSX.Element {
  const options = useCreateChatOptions()
  return (
    <CreateChatSession
      options={options}
      onSubmit={submitCreateChatDraft}
      heading={translate('components.tasksHome.heading', 'What do you want to do?')}
      subheading={null}
      layout="top"
      below={<TasksHomeApprovals />}
    />
  )
}
