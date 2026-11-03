import type { TuiAgent } from './tui-agent'
import type {
  CommitMessageAgentSpec,
  CommitMessageModel,
  ThinkingLevel
} from './commit-message-agent-spec'
import { CLAUDE_MODEL_LIST_ARGS, CLAUDE_MODEL_LIST_STDIN } from './claude-model-list-probe'

type PrimaryAgentSpecDeps = {
  CLAUDE_THINKING_LEVELS: ThinkingLevel[]
  OPENAI_THINKING_LEVELS: ThinkingLevel[]
  parseClaudeModels: (stdout: string) => CommitMessageModel[]
  parseCodexModels: (stdout: string) => CommitMessageModel[]
  parseLineModels: (stdout: string) => CommitMessageModel[]
  parsePiModels: (stdout: string) => CommitMessageModel[]
  withOpenAiThinking: (
    id: string
  ) => Pick<CommitMessageModel, 'thinkingLevels' | 'defaultThinkingLevel'>
}

const WEB_TOOLS = ['WebSearch', 'WebFetch']
const CODE_READ_TOOLS = ['Read', 'Grep', 'Glob']
// Why: the agent's own `openmetadata` read server is the only MCP allowed; the write server and any
// mutating tool the read server lists are denied, and a denial beats an allow.
const OPENMETADATA_READ = 'mcp__openmetadata__*'
// Why: Engram's read tools only, so a bot can recall project history; saving memory stays denied.
const ENGRAM_READ = [
  'mcp__engram__mem_search',
  'mcp__engram__mem_context',
  'mcp__engram__mem_get_observation'
]
const MUTATING_DENIED = [
  'mcp__openmetadata-escritura__*',
  'mcp__openmetadata__create_entity',
  'mcp__openmetadata__create_lineage',
  'mcp__openmetadata__create_test_case',
  'mcp__openmetadata__patch_entity',
  'Bash',
  'Edit',
  'Write',
  'NotebookEdit'
]

/** The Claude tool flags of a turn: `tools` are the built-ins it keeps; MCP stays the user's own, read server only. */
function claudeToolArgs(tools: readonly string[]): string[] {
  return [
    '--tools',
    tools.join(','),
    '--allowedTools',
    [...tools, OPENMETADATA_READ, ...ENGRAM_READ].join(','),
    '--disallowedTools',
    MUTATING_DENIED.join(',')
  ]
}

export function buildPrimaryCommitMessageAgentSpecs({
  CLAUDE_THINKING_LEVELS,
  OPENAI_THINKING_LEVELS,
  parseClaudeModels,
  parseCodexModels,
  parseLineModels,
  parsePiModels,
  withOpenAiThinking
}: PrimaryAgentSpecDeps): Partial<Record<TuiAgent, CommitMessageAgentSpec>> {
  return {
    claude: {
      id: 'claude',
      label: 'Claude',
      binary: 'claude',
      // Why: diffs can be large and `claude -p` reads from stdin natively when no
      // positional prompt is provided.
      promptDelivery: 'stdin',
      buildArgs: ({ model, thinkingLevel }) => [
        '-p',
        '--output-format',
        'text',
        // Why: an empty model inherits the CLI's own default, so no --model flag.
        ...(model ? ['--model', model] : []),
        '--permission-mode',
        'plan',
        ...(thinkingLevel ? ['--effort', thinkingLevel] : [])
      ],
      // Why: a research turn gets the two web tools and the OpenMetadata read server; plan mode still
      // refuses edits and the user's other MCP servers are never allowed.
      webResearchArgs: claudeToolArgs(WEB_TOOLS),
      // Why: a code turn also reads the checkout (Read, Grep, Glob) and keeps the user's MCP config.
      codeReadArgs: {
        add: (research) =>
          claudeToolArgs(research ? [...CODE_READ_TOOLS, ...WEB_TOOLS] : CODE_READ_TOOLS)
      },
      modelSource: 'dynamic',
      // Why: the Claude CLI has no listing subcommand; one list_models control
      // request over --print stream-json returns the /model picker catalog.
      // Older CLIs answer with a control error and exit 0, keeping the fallback.
      modelDiscovery: {
        binary: 'claude',
        args: [...CLAUDE_MODEL_LIST_ARGS],
        stdinPayload: CLAUDE_MODEL_LIST_STDIN,
        parse: parseClaudeModels
      },
      models: [
        {
          // Why: Claude Code aliases track the account/provider's supported
          // model IDs; hardcoded version IDs can be rejected by Bedrock/Vertex.
          id: 'haiku',
          label: 'Haiku'
        },
        {
          id: 'sonnet',
          label: 'Sonnet',
          thinkingLevels: CLAUDE_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'opus',
          label: 'Opus',
          thinkingLevels: CLAUDE_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        }
      ],
      defaultModelId: 'sonnet'
    },
    codex: {
      id: 'codex',
      label: 'Codex',
      binary: 'codex',
      // Why: `codex exec` reads stdin when no prompt arg is supplied. Commit
      // prompts include large staged diffs, so argv would exceed Windows and
      // some SSH/POSIX command-line limits.
      promptDelivery: 'stdin',
      buildArgs: ({ model, thinkingLevel }) => [
        'exec',
        // Why: commit-message generation needs text only, not a persisted agent
        // session or workspace writes. Match the safe git-text mode used by
        // local-first coding agents.
        '--ephemeral',
        '--skip-git-repo-check',
        '-s',
        'read-only',
        '--model',
        model,
        ...(thinkingLevel ? ['-c', `model_reasoning_effort=${thinkingLevel}`] : [])
      ],
      // Why: `exec` has no --search flag; this override turns on the native web_search tool (CLI 0.159).
      webResearchArgs: ['-c', 'web_search="live"'],
      // Why: a room turn must not reach the user's plugins, connectors or MCP write tools. Verified on codex-cli
      // 0.159.2: --ignore-user-config drops the user's config, and the disabled features drop the built-in apps,
      // image and goal tools; the read-only sandbox still rejects apply_patch and exec_command writes.
      roomTurnArgs: [
        '--ignore-user-config',
        '--disable',
        'apps',
        '--disable',
        'plugins',
        '--disable',
        'image_generation',
        '--disable',
        'goals'
      ],
      // Why: no code read mode: Codex's `mcp_servers` overrides leave its plugin and connector tools
      // enabled (codex-cli 0.159.2 smoke), so a code turn could reach a write tool.
      // `-c` is intentionally absent: Codex accepts repeated overrides.
      singletonOptions: [['--model', '-m']],
      modelSource: 'dynamic',
      modelDiscovery: {
        binary: 'codex',
        args: ['debug', 'models'],
        parse: parseCodexModels
      },
      // Why: ordered to match the official `codex` model picker — descending
      // by version so the frontier model lands on top and legacy models trail.
      models: [
        {
          id: 'gpt-5.6-terra',
          label: 'GPT-5.6 Terra',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.5',
          label: 'GPT-5.5',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.4',
          label: 'GPT-5.4',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.4-mini',
          label: 'GPT-5.4 Mini',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.3-codex',
          label: 'GPT-5.3 Codex',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          // Why: Codex's Spark variant accepts `model_reasoning_effort` (the
          // CLI banner reports "reasoning effort: medium" by default); the
          // gating that surfaces "model not supported" is on the account
          // tier, not the effort flag.
          id: 'gpt-5.3-codex-spark',
          label: 'GPT-5.3 Codex Spark',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.2',
          label: 'GPT-5.2',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        }
      ],
      defaultModelId: 'gpt-5.6-terra'
    },
    opencode: {
      id: 'opencode',
      label: 'OpenCode',
      binary: 'opencode',
      // Why: Source Control AI prompts can include large staged diffs; OpenCode
      // accepts the prompt on stdin, which avoids cross-platform argv limits.
      promptDelivery: 'stdin',
      buildArgs: ({ model, thinkingLevel }) => [
        'run',
        ...(model && model !== 'default' ? ['--model', model] : []),
        '--agent',
        'build',
        '--format',
        'json',
        ...(thinkingLevel ? ['--variant', thinkingLevel] : [])
      ],
      singletonOptions: [['--model', '-m'], ['--agent'], ['--format'], ['--variant']],
      modelSource: 'dynamic',
      modelDiscovery: { binary: 'opencode', args: ['models'], parse: parseLineModels },
      models: [
        { id: 'default', label: 'Config default' },
        {
          id: 'opencode/gpt-5.4-mini',
          label: 'OpenCode GPT 5.4 Mini',
          ...withOpenAiThinking('gpt-5.4-mini')
        }
      ],
      defaultModelId: 'default'
    },
    opencode2: {
      id: 'opencode2',
      label: 'OpenCode 2',
      binary: 'opencode2',
      promptDelivery: 'stdin',
      buildArgs: ({ model, thinkingLevel }) => [
        'run',
        ...(model && model !== 'default'
          ? ['--model', thinkingLevel ? `${model}#${thinkingLevel}` : model]
          : []),
        '--agent',
        'build',
        '--format',
        'json'
      ],
      singletonOptions: [['--model', '-m'], ['--agent'], ['--format']],
      modelSource: 'dynamic',
      modelDiscovery: { binary: 'opencode2', args: ['models'], parse: parseLineModels },
      models: [
        { id: 'default', label: 'Config default' },
        {
          id: 'opencode/gpt-5.4-mini',
          label: 'OpenCode GPT 5.4 Mini',
          ...withOpenAiThinking('gpt-5.4-mini')
        }
      ],
      defaultModelId: 'default'
    },
    pi: {
      id: 'pi',
      label: 'Pi',
      binary: 'pi',
      promptDelivery: 'stdin',
      buildArgs: ({ model, thinkingLevel }) => [
        '--print',
        '--no-session',
        '--no-tools',
        '--no-skills',
        '--no-context-files',
        '--mode',
        'text',
        ...(model && model !== 'default' ? ['--model', model] : []),
        ...(thinkingLevel ? ['--thinking', thinkingLevel] : [])
      ],
      // Why: Pi's `--tools` allowlist (docs/cli.md) keeps only the four read-only built-ins.
      codeReadArgs: { add: () => ['--tools', 'read,grep,find,ls'], drop: ['--no-tools'] },
      modelSource: 'dynamic',
      modelDiscovery: { binary: 'pi', args: ['--list-models'], parse: parsePiModels },
      models: [
        {
          // Why: the unqualified choice lets Pi use its configured provider and
          // avoids forcing GitHub Copilot credentials during automation.
          id: 'default',
          label: 'Config default'
        }
      ],
      defaultModelId: 'default'
    }
  }
}
