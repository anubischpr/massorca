import { GLOBAL_FLAGS, type CommandSpec } from '../args'

// Why: a name resolves through the team's own bots and projects; an ambiguous name is refused, never guessed.
export const BOT_TEAMS_PROJECT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['bot-teams', 'task', 'create'],
    summary: 'Save a task for one of a Bot team bots to its Todo, without starting it',
    usage:
      'orca bot-teams task create --team <id> --title <text> --bot <name|id> [--prompt <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'title', 'bot', 'prompt'],
    examples: ['orca bot-teams task create --team <id> --title "Write notes" --bot Pepe']
  },
  {
    path: ['bot-teams', 'task', 'start'],
    summary: 'Start a task that waits in Todo',
    usage: 'orca bot-teams task start --task <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'task'],
    notes: ['A task already starting or running is refused.']
  },
  {
    path: ['bot-teams', 'task', 'reassign'],
    summary: 'Give an idle task to another bot of a Bot team',
    usage: 'orca bot-teams task reassign --team <id> --task <id> --bot <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'task', 'bot'],
    notes: ['Nothing starts: run `bot-teams task start` after reassigning.']
  },
  {
    path: ['bot-teams', 'task', 'set-project'],
    summary: 'Set or clear the project of a task',
    usage:
      'orca bot-teams task set-project --team <id> --task <id> --project <name|id|none> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'task', 'project']
  },
  {
    path: ['bot-teams', 'project', 'create'],
    summary: 'Create a project on a Bot team',
    usage:
      'orca bot-teams project create --team <id> --name <text> [--goal <text>] [--code-source repo|folder] [--link-team <id,...>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'name', 'goal', 'code-source', 'link-team'],
    notes: ['--link-team lists other team ids that work on the project too.']
  },
  {
    path: ['bot-teams', 'project', 'update'],
    summary: 'Rename a project, change its goal, or change the teams linked to it',
    usage:
      'orca bot-teams project update --team <id> --project <name|id> [--name <text>] [--goal <text>] [--link-team <id,...>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'project', 'name', 'goal', 'link-team'],
    notes: ['Only the owner team may change its project; --link-team replaces the linked teams.']
  },
  {
    path: ['bot-teams', 'project', 'archive'],
    destructive: true,
    summary: 'Archive a project so it leaves the room lists',
    usage: 'orca bot-teams project archive --team <id> --project <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'project'],
    notes: ['Restore it with `bot-teams project restore`.']
  },
  {
    path: ['bot-teams', 'project', 'restore'],
    summary: 'Bring an archived project back to the room lists',
    usage: 'orca bot-teams project restore --team <id> --project <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'project']
  },
  {
    path: ['bot-teams', 'project', 'rm'],
    destructive: true,
    summary: 'Delete a project on a Bot team',
    usage: 'orca bot-teams project rm --team <id> --project <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'project'],
    notes: ['Only the owner team may delete its project. Its tasks stay on the team.']
  },
  {
    path: ['bot-teams', 'project', 'brief'],
    summary: "Replace a project's Brief from JSON",
    usage:
      'orca bot-teams project brief --team <id> --project <name|id> (--brief-json <json> | --brief-stdin) [--goal <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'project', 'goal', 'brief-json', 'brief-stdin'],
    notes: [
      'The JSON holds requirements, constraints and decisions (arrays of text) and optional markdown. It replaces the whole Brief.'
    ],
    examples: [
      `orca bot-teams project brief --team <id> --project Launch --brief-json '{"requirements":["Ship by Friday"],"constraints":[],"decisions":["Use Vite"]}'`
    ]
  },
  {
    path: ['bot-teams', 'project', 'code-source'],
    summary: 'Set where a project code comes from: a repository or a folder',
    usage:
      'orca bot-teams project code-source --team <id> --project <name|id> --source repo|folder [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'project', 'source']
  },
  {
    path: ['bot-teams', 'project', 'workspace'],
    summary: 'Link a project to a Workspaces project, or unlink it with none',
    usage:
      'orca bot-teams project workspace --team <id> --project <name|id> --workspace <key|none> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'project', 'workspace'],
    notes: ['Unlinked tasks run in the team folder again.']
  }
]
