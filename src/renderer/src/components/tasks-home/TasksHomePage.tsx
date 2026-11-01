import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { CreateChatSession } from '../create-chat/CreateChatSession'
import { submitCreateChatDraft } from '../create-chat/create-chat-submit'
import { useCreateChatOptions } from '../create-chat/use-create-chat-options'
import { TasksHomeApprovals } from './TasksHomeApprovals'
import { TasksHomeBotTeamSession } from './TasksHomeBotTeamSession'
import { TasksHomeCreateSwitch } from './TasksHomeCreateSwitch'
import { defaultTasksHomeCreateMode, type TasksHomeCreateMode } from './tasks-home-create-modes'

/** The rail's Tasks page: the + Create composer, then the sessions that need the user. */
export default function TasksHomePage(): React.JSX.Element {
  const options = useCreateChatOptions()
  // Entered from Bot teams mode, the switch starts on Bot Team; after that the person owns it.
  const [mode, setMode] = useState<TasksHomeCreateMode>(() =>
    defaultTasksHomeCreateMode(useAppStore.getState().railMode)
  )
  const aboveComposer = <TasksHomeCreateSwitch mode={mode} onModeChange={setMode} />
  const below = <TasksHomeApprovals />
  if (mode === 'bot-team') {
    return <TasksHomeBotTeamSession aboveComposer={aboveComposer} below={below} />
  }
  return (
    <CreateChatSession
      options={options}
      onSubmit={submitCreateChatDraft}
      heading={translate('components.tasksHome.heading', 'What do you want to do?')}
      subheading={null}
      layout="top"
      aboveComposer={aboveComposer}
      below={below}
    />
  )
}
