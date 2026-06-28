# Contributing to AICLI

Thank you for considering a contribution! This document covers how to get set
up, the project conventions, and the process for submitting changes.

---

## Getting Started

### Prerequisites

- Node.js >= 18 (LTS recommended)
- npm >= 8
- Git
- An API key for at least one provider (Ollama works offline)

### Fork and Clone

```bash
git clone https://github.com/your-fork/aicli.git
cd aicli
npm install
```

### Development Mode

```bash
npm run dev                   # Run with ts-node (no build step)
DEBUG=true npm run dev        # Enable debug logging
npm run dev -- --path /my/project
```

### Run Tests

```bash
npm test                      # All tests + coverage
npm run test:unit             # Unit tests only (faster)
npm run test:integration      # Integration tests
```

### Lint and Format

```bash
npm run lint                  # ESLint check
npm run lint:fix              # Auto-fix lint errors
npm run format                # Prettier
```

### Build

```bash
npm run build                 # Compile to dist/
node dist/index.js            # Run the compiled binary
```

---

## Project Structure

```
src/
  index.ts          Entry point (Commander.js CLI)
  cli/
    repl.ts         Main REPL loop
    state.ts        Application state type
    ai-agent.ts     Tool call parsing + execution
  providers/        One file per AI provider
  commands/         One file per slash command group
  config/           Types + config manager
  session/          Session persistence
  memory/           Context windowing + pinned snippets
  indexer/          Project file indexer
  git/              simple-git wrapper
  github/           GitHub API client
  tools/
    file.ts         File read/write/diff
    search.ts       Text search
    executor.ts     Safe shell command runner
  utils/
    logger.ts       Winston logger
    terminal.ts     Chalk, Markdown, tables
tests/
  unit/             Unit tests (one file per module)
  integration/      End-to-end flow tests
docs/               Markdown documentation
.github/workflows/  CI/CD pipelines
```

---

## Conventions

### Code Style

- TypeScript strict mode is enabled — no `any` unless absolutely necessary
- ESLint + Prettier enforce formatting (run `npm run format` before committing)
- `async/await` over raw Promises
- Named exports over default exports
- Classes for stateful singletons, plain functions for utilities

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add /snippet command for pinning context
fix: correctly parse SSE chunks from OpenRouter
docs: add provider guide to docs/PROVIDERS.md
test: add unit tests for ContextManager
refactor: extract token estimation to contextManager
chore: upgrade @anthropic-ai/sdk to 0.28.0
```

### Branch Naming

```
feat/my-feature
fix/issue-123
docs/update-readme
chore/upgrade-deps
```

---

## Adding a New Provider

1. Create `src/providers/myprovider.ts` extending `BaseProvider`:

```typescript
import { BaseProvider, ModelInfo, ChatOptions } from './base';
import { StreamChunk } from '../config/types';
import { configManager } from '../config/manager';

export class MyProvider extends BaseProvider {
  readonly name = 'myprovider' as const;
  readonly displayName = 'My Provider';

  isConfigured(): boolean {
    return !!configManager.getApiKey('myprovider');
  }

  async listModels(): Promise<ModelInfo[]> {
    // Fetch or return hardcoded model list
    return [{ id: 'my-model-v1', name: 'My Model v1', tags: ['coding'] }];
  }

  async chat(options: ChatOptions): Promise<string> {
    // Make non-streaming API call, return string
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    // Yield { content, done } chunks
  }
}
```

2. Add `'myprovider'` to `ProviderName` in `src/config/types.ts`
3. Add default config entry in `src/config/manager.ts` → `DEFAULT_CONFIG.providers`
4. Add env var mapping in `getApiKey()` in `src/config/manager.ts`
5. Register in `src/providers/registry.ts`
6. Add unit tests in `tests/unit/`

---

## Adding a New Slash Command

1. Add the class to `src/commands/implementations.ts`:

```typescript
export class MyCommand extends BaseCommand {
  readonly name = 'mycommand';
  readonly description = 'What it does';
  readonly usage = '/mycommand <arg>';
  readonly aliases = ['mc'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    // implementation
    return { handled: true };
  }
}
```

2. Import and register in `src/commands/index.ts`:

```typescript
import { MyCommand } from './implementations';

// Inside registerCommands():
new MyCommand(),
```

3. Add to the help table in `HelpCommand.execute()`
4. Document in `docs/COMMANDS.md`
5. Write unit tests

---

## Pull Request Process

1. Fork → branch → code → tests → docs
2. Ensure `npm test` and `npm run lint` pass with no errors
3. Open a PR against `main` with:
   - A clear title following Conventional Commits
   - Description of what changed and why
   - Screenshots or terminal output for UI changes
   - Reference to any related issues (`Closes #123`)
4. A maintainer will review within 48 hours

---

## Code of Conduct

Be kind and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

Harassment, discrimination, or abusive behavior of any kind will not be tolerated.
