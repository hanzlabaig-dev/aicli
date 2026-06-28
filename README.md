# AICLI — AI Coding CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![npm](https://img.shields.io/npm/v/@hanzlabaig-dev/aicli)](https://www.npmjs.com/package/@hanzlabaig-dev/aicli)
[![GitHub](https://img.shields.io/github/stars/hanzlabaig-dev/aicli)](https://github.com/hanzlabaig-dev/aicli)

**A production-quality, terminal-based AI Coding CLI** supporting multiple AI providers with a beautiful interactive interface, file operations, Git integration, GitHub integration, and project-aware code assistance.

---

## Features

- **Multi-provider support** — OpenRouter, Anthropic Claude, OpenAI, Google Gemini, and Ollama (local)
- **Streaming AI responses** with real-time output
- **File operations** — read, create, edit, rename, delete with diff previews and confirmation
- **Project indexing** — fast file search and semantic context for the AI
- **Git integration** — status, diff, log, commit, branch, push, pull
- **GitHub integration** — auth, repos, clone, pull requests
- **Slash commands** — `/help`, `/config`, `/provider`, `/models`, `/git`, `/github`, `/search`, etc.
- **Session management** — persistent conversations, history, export
- **Syntax highlighting** and Markdown rendering in terminal
- **Cross-platform** — Windows, Linux, macOS
- **Secure** — API keys stored locally, never logged

---

## Installation

### Via npm (global)

```bash
npm install -g aicli
```

### From source

```bash
git clone https://github.com/thebitforge/aicli
cd aicli
npm install
npm run build
npm link
```

### Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

---

## Quick Start

```bash
# Start in current directory
aicli

# Start in a specific project
aicli --path /path/to/project

# With a specific provider
aicli --provider anthropic

# With a specific model
aicli --model claude-3-5-sonnet-20241022
```

---

## Configuration

### API Keys

Set API keys via the CLI or environment variables:

```bash
# Via CLI
/config set provider.openrouter.apiKey sk-or-your-key
/config set provider.anthropic.apiKey sk-ant-your-key
/config set provider.openai.apiKey sk-your-key
/config set provider.gemini.apiKey your-key

# Via environment variables
export OPENROUTER_API_KEY=sk-or-your-key
export ANTHROPIC_API_KEY=sk-ant-your-key
export OPENAI_API_KEY=sk-your-key
export GEMINI_API_KEY=your-key
```

Configuration is stored at `~/.aicli/config.json`.

### GitHub Authentication

```bash
/github auth ghp_your-personal-access-token
```

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/config [set key value]` | View or edit configuration |
| `/provider <name>` | Switch provider (openrouter\|anthropic\|openai\|gemini\|ollama) |
| `/models [filter]` | Browse and select a model interactively |
| `/history [n]` | View last n messages |
| `/session [list\|load\|delete\|export]` | Manage sessions |
| `/clear` | Clear conversation |
| `/reset` | Start a new session |
| `/git [status\|diff\|log\|commit\|branch\|push\|pull]` | Git operations |
| `/github [auth\|repos\|clone\|pr]` | GitHub integration |
| `/index [path]` | Index project files for search |
| `/search <query>` | Search indexed project |
| `/theme <dark\|light>` | Change color theme |
| `/version` | Version information |
| `/exit` | Exit the application |

---

## AI File Operations

The AI assistant can perform file operations that you review before applying:

- **Read files**: "Show me the contents of src/index.ts"
- **Create files**: "Create a new utility file for date formatting"
- **Edit files**: "Fix the TypeScript error in src/auth.ts"
- **Delete files**: "Remove the deprecated helper.js file"
- **Rename files**: "Rename utils.js to utils.ts"
- **Search project**: "Where is the authentication logic?"

All file changes show a diff and require your confirmation before being applied.

---

## Project Indexing

When you start AICLI in a project, it automatically indexes your codebase to give the AI context:

```bash
# Manual indexing
/index

# Search the index
/search authentication
/search database connection
/search API routes
```

The indexer understands:
- Languages (TypeScript, JavaScript, Python, Go, Rust, etc.)
- Frameworks (Next.js, React, Django, FastAPI, etc.)
- Package managers (npm, yarn, pnpm, pip, cargo, etc.)
- Project structure

---

## Git Integration

```bash
/git status          # Working tree status
/git diff            # Show unstaged changes
/git diff --cached   # Show staged changes
/git log [n]         # Recent commits
/git commit          # Commit with AI-generated message
/git commit "msg"    # Commit with custom message
/git branch          # List branches
/git checkout main   # Switch branch
/git checkout -b feat/new-feature   # Create and switch
/git push            # Push to origin
/git pull            # Pull from origin
```

---

## GitHub Integration

```bash
/github auth <token>      # Authenticate with PAT
/github repos             # List your repositories
/github clone owner/repo  # Clone a repository
/github pr               # List pull requests
```

---

## Providers

### OpenRouter (default)

Access 200+ models from a single API key. Supports filtering by:
- `coding` — Code-focused models
- `reasoning` — Chain-of-thought models
- `vision` — Multimodal models
- `free` — Zero-cost models
- `large-context` — 100k+ context models

```bash
/models coding        # Filter by coding tag
/models gpt           # Search by name
/models free          # Free models only
```

### Anthropic

```bash
/provider anthropic
/models    # Lists Claude models
```

### OpenAI

```bash
/provider openai
/models    # Fetches available GPT models
```

### Google Gemini

```bash
/provider gemini
/models    # Lists Gemini models
```

### Ollama (Local)

Run models completely offline:

```bash
ollama pull llama3.1   # Download a model
aicli --provider ollama
/models                # Lists locally installed models
```

---

## Architecture

```
src/
├── index.ts              # CLI entry point (Commander.js)
├── cli/
│   ├── repl.ts           # Main REPL loop
│   ├── state.ts          # Application state
│   └── ai-agent.ts       # AI tool call parsing & execution
├── providers/
│   ├── base.ts           # Abstract BaseProvider
│   ├── registry.ts       # Provider registry
│   ├── openrouter.ts     # OpenRouter integration
│   ├── anthropic.ts      # Anthropic Claude integration
│   ├── openai.ts         # OpenAI integration
│   ├── gemini.ts         # Google Gemini integration
│   └── ollama.ts         # Ollama local integration
├── commands/
│   ├── registry.ts       # Command registry
│   ├── implementations.ts # All slash commands
│   └── index.ts          # Registration
├── config/
│   ├── types.ts          # TypeScript type definitions
│   └── manager.ts        # Config persistence
├── session/
│   └── manager.ts        # Session management
├── indexer/
│   └── project.ts        # Project file indexer
├── git/
│   └── integration.ts    # Git operations (simple-git)
├── github/
│   └── integration.ts    # GitHub API
├── tools/
│   └── file.ts           # File read/write/diff operations
└── utils/
    ├── logger.ts         # Winston logging
    └── terminal.ts       # Chalk, Markdown, table rendering
```

---

## Development

### Setup

```bash
git clone https://github.com/thebitforge/aicli
cd aicli
npm install
```

### Development Mode

```bash
npm run dev               # Run with ts-node
DEBUG=true npm run dev    # With debug logging
```

### Build

```bash
npm run build             # Compile TypeScript
npm run clean             # Remove dist/
```

### Testing

```bash
npm test                  # All tests with coverage
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
```

### Linting

```bash
npm run lint              # Check
npm run lint:fix          # Auto-fix
npm run format            # Prettier
```

---

## Adding a New Provider

1. Create `src/providers/myprovider.ts` extending `BaseProvider`:

```typescript
import { BaseProvider, ModelInfo, ChatOptions } from './base';
import { StreamChunk } from '../config/types';

export class MyProvider extends BaseProvider {
  readonly name = 'myprovider';
  readonly displayName = 'My Provider';

  isConfigured(): boolean { ... }
  async listModels(): Promise<ModelInfo[]> { ... }
  async chat(options: ChatOptions): Promise<string> { ... }
  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> { ... }
}
```

2. Register in `src/providers/registry.ts`
3. Add `ProviderName` union in `src/config/types.ts`
4. Add default config in `src/config/manager.ts`
5. Add env var mapping in `getApiKey()`

---

## Adding a New Command

```typescript
// src/commands/implementations.ts
export class MyCommand extends BaseCommand {
  readonly name = 'mycommand';
  readonly description = 'Does something useful';
  readonly usage = '/mycommand <arg>';
  readonly aliases = ['mc'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    // Your implementation
    return { handled: true };
  }
}
```

Register in `src/commands/index.ts`:
```typescript
new MyCommand(),
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `LOG_LEVEL` | Logging level (info/debug/warn/error) |
| `DEBUG` | Enable console logging (true/false) |
| `NODE_ENV` | Environment (development/production) |

---

## Security

- API keys are stored in `~/.aicli/config.json` with user-only permissions
- Keys are never logged or included in error messages (auto-redacted)
- API keys in env variables take precedence over config file
- No telemetry or analytics

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Run `npm test && npm run lint`
5. Commit: `git commit -m "feat: add my feature"`
6. Push and open a Pull Request

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

---

## License

MIT © [Hanzla Baig - AICLI](https://github.com/hanzlabaig-dev)
