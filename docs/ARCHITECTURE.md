# Architecture

This document describes the design decisions and module interactions in AICLI.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                        CLI Entry                         │
│                      src/index.ts                        │
│           (Commander.js — argument parsing)              │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    REPL  src/cli/repl.ts                 │
│  • readline interface with tab-completion                │
│  • Routes /commands → CommandRegistry                    │
│  • Routes chat input → AI Agent + Provider               │
│  • Context trimming via ContextManager                   │
└────────┬────────────────────────┬───────────────────────┘
         │                        │
         ▼                        ▼
┌────────────────┐    ┌──────────────────────────────────┐
│ CommandRegistry│    │       AI Agent                    │
│ (slash cmds)   │    │  src/cli/ai-agent.ts              │
│                │    │  • Builds system prompt            │
│ /help /git     │    │  • Parses tool calls from response │
│ /github /index │    │  • Executes file/search/run ops   │
│ /session /pin  │    │  • Confirms destructive actions    │
└────────┬───────┘    └─────────────┬────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────────────────────────────────────────┐
│                    Tool Layer                          │
│  FileTools      SearchFiles    ExecCommand            │
│  (read/write/   (text regex    (shell with            │
│   diff/rename)   search)        timeout+safety)       │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│                  Provider Layer                        │
│                                                       │
│  ProviderRegistry (singleton)                         │
│    ├─ OpenRouterProvider  (streaming SSE)             │
│    ├─ AnthropicProvider   (Anthropic SDK)             │
│    ├─ OpenAIProvider      (OpenAI SDK)                │
│    ├─ GeminiProvider      (Google GenAI SDK)          │
│    └─ OllamaProvider      (HTTP to local server)      │
└──────────────────────────────────────────────────────┘
```

---

## Core Modules

### `src/cli/repl.ts` — The REPL

The main event loop. Uses Node.js `readline` for line-by-line input with
tab-completion and history. On each input:

1. If the line starts with `/` → route to `CommandRegistry`
2. Otherwise → add to session, build system prompt, call provider stream

The REPL also owns startup sequencing: banner, Git detection, auto-indexing.

### `src/cli/ai-agent.ts` — Tool Execution

Parses `\`\`\`tool\n{...}\n\`\`\`` blocks embedded in AI responses and executes
the corresponding operations. All destructive operations (edit, delete, rename,
run command) show an `enquirer` confirmation prompt before proceeding.

Tool calls that mutate files always go through `FileTools.generateDiff()` first
so the user sees a coloured diff in the terminal.

After tool calls, the results are fed back into the conversation as a user
message so the AI can follow up.

### `src/providers/` — Provider Abstraction

Each provider implements `BaseProvider`:

```typescript
abstract class BaseProvider {
  abstract isConfigured(): boolean;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract chat(options: ChatOptions): Promise<string>;
  abstract chatStream(options: ChatOptions): AsyncGenerator<StreamChunk>;
}
```

Streaming is implemented with `AsyncGenerator<StreamChunk>`. The REPL consumes
chunks with `for await`, writing directly to `process.stdout` for zero-latency
display.

`ProviderRegistry` is a singleton that holds all provider instances and
delegates to the currently active one based on config.

### `src/memory/context.ts` — Token Windowing

`ContextManager.trim()` drops the oldest messages from the front of the
conversation when the estimated token count exceeds `maxContextTokens`. It
always preserves the last message. Token count is estimated at 4 chars/token.

### `src/memory/snippets.ts` — Pinned Context

Users can pin code snippets or notes that are injected into every system prompt.
Useful for project conventions, key type definitions, or API references that the
AI should always be aware of. Snippets persist across sessions.

### `src/indexer/project.ts` — Project Indexer

On startup (or `/index`), the indexer:
1. Scans the project with `glob`, skipping `node_modules`, `.git`, `dist`, etc.
2. Reads file contents (up to 100KB each, max 5000 files)
3. Builds an inverted keyword index: `word → [file paths]`
4. Detects language, framework, and package manager from file presence
5. Generates a compact file tree for injection into the system prompt

Search uses partial word matching — "auth" will match "authenticate", "authentication", etc.

### `src/git/integration.ts` — Git

A thin wrapper around [simple-git](https://github.com/steveukx/git-js). All
Git operations are performed in the project's working directory. The
`/git commit` command can auto-generate a commit message by analyzing the diff.

### `src/github/integration.ts` — GitHub API

Uses the GitHub REST API v3 via `axios`. A Personal Access Token (PAT) is
required — it is stored in `~/.aicli/config.json` and never logged.

### `src/config/manager.ts` — Configuration

Config is stored at `~/.aicli/config.json`. API keys can come from:
1. Environment variables (highest priority)
2. Config file

Keys are never written to logs. The `sanitizeError()` method in `BaseProvider`
strips `sk-*` patterns from error messages before logging.

### `src/session/manager.ts` — Session Persistence

Each session is stored as a JSON file in `~/.aicli/sessions/<uuid>.json`.
Sessions contain the full message history, provider, model, and project path.
They can be loaded, exported as Markdown, or deleted via `/session` commands.

---

## Data Flow: A Single Chat Turn

```
User types: "Fix the TypeScript error in src/api/routes.ts"
     │
     ▼
REPL.handleChat()
     │
     ├─ sessionManager.addMessage('user', input)
     ├─ projectIndexer.getContext()          (project metadata)
     ├─ snippetStore.renderForSystemPrompt() (pinned snippets)
     ├─ buildSystemPrompt(state)             (system prompt)
     ├─ contextManager.trim(messages)        (fit in token budget)
     │
     ▼
provider.chatStream({ model, messages, systemPrompt })
     │
     ├─ Chunks streamed to stdout in real-time
     ├─ Full response accumulated in `fullResponse`
     │
     ▼
parseToolCalls(fullResponse)
     │
     ├─ If tool calls present:
     │    ├─ Show diff / prompt for confirmation
     │    ├─ executeToolCalls(calls, state)
     │    ├─ sessionManager.addMessage('assistant', fullResponse)
     │    └─ sessionManager.addMessage('user', toolResults)
     │         └─ (recursive call to get follow-up response)
     │
     └─ If no tool calls:
          └─ sessionManager.addMessage('assistant', fullResponse)
```

---

## Security Model

| Concern | Mitigation |
|---------|-----------|
| API key exposure in logs | Keys redacted from all log entries; `sanitizeError()` strips `sk-*` patterns |
| API key exposure in config | File stored at `~/.aicli/config.json`; recommend `chmod 600` |
| Arbitrary shell execution | All `run_command` tool calls require explicit user confirmation |
| Destructive file operations | Edit/delete/rename show confirmation prompt before proceeding |
| Dangerous shell patterns | `execCommand()` blocks known dangerous patterns (`rm -rf /`, fork bomb, etc.) |
| Process timeout | All shell commands have a configurable timeout (default 30s) |

---

## Extension Points

| What to add | Where to change |
|-------------|----------------|
| New AI provider | `src/providers/`, `registry.ts`, `types.ts`, `manager.ts` |
| New slash command | `src/commands/implementations.ts`, `index.ts` |
| New tool call type | `src/cli/ai-agent.ts` → `executeToolCalls` switch |
| New indexer heuristic | `src/indexer/project.ts` → `analyzeContext` |
| New memory strategy | `src/memory/` |
