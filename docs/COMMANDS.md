# Command Reference

All commands are prefixed with `/`. Tab-completion is available in the REPL.

---

## General

### `/help` (aliases: `/h`, `/?`)
Show all available commands.

```
/help
```

### `/version` (aliases: `/v`, `/ver`)
Show version, Node.js, platform, provider, and model information.

### `/exit` (aliases: `/quit`, `/q`, `/bye`)
Exit AICLI. Also works with `Ctrl+D`.

---

## Configuration

### `/config [set <key> <value>]`
View all configuration, or set a specific value.

```bash
/config                                         # View config (keys redacted)
/config set provider.openrouter.apiKey sk-key  # Set OpenRouter key
/config set provider.anthropic.apiKey sk-key   # Set Anthropic key
/config set provider.openai.apiKey sk-key      # Set OpenAI key
/config set provider.gemini.apiKey key         # Set Gemini key
/config set provider.ollama.baseUrl http://... # Set Ollama URL
```

### `/provider <name>` (alias: `/p`)
Switch the active AI provider.

```bash
/provider openrouter
/provider anthropic
/provider openai
/provider gemini
/provider ollama
```

### `/models [filter]` (aliases: `/model`, `/m`)
Browse and select a model interactively. Supports fuzzy filtering.

```bash
/models                # All models for current provider
/models gpt-4          # Filter by name
/models coding         # Filter by tag
/models free           # Free-tier models only
```

### `/theme <name>`
Change the color theme.

```bash
/theme dark
/theme light
/theme system
```

---

## Conversation

### `/history [n]` (alias: `/hist`)
Show the last *n* messages (default: 10).

```bash
/history
/history 20
```

### `/clear` (alias: `/cls`)
Clear the current conversation and console.

### `/reset`
Start a completely new session (discards current conversation).

### `/pin [list|remove <id>|clear]`
Pin a code snippet or note to the AI context. Pinned snippets are appended to
the system prompt in every request.

```bash
/pin                    # List all pinned snippets
/pin "API Base URL"     # Pin a new snippet (prompts for content)
/pin remove snip_123    # Remove by ID
/pin clear              # Remove all snippets
```

---

## Sessions

### `/session [list|load|delete|export]` (aliases: `/sess`, `/s`)

```bash
/session                        # List all saved sessions
/session list                   # Same as above
/session load <id>              # Load a saved session
/session delete <id>            # Delete a session
/session export                 # Export current session to Markdown file
```

---

## File System

These features are available via natural language chat. Just ask:

- *"Read src/auth.ts"*
- *"Create a new file src/utils/date.ts with a formatDate function"*
- *"Fix the TypeScript error in src/api/routes.ts"*
- *"Delete the unused helper.js file"*
- *"Rename components/Btn.tsx to components/Button.tsx"*

All file changes show a **diff preview** and require your confirmation.

---

## Project Search

### `/index [path]`
Index the project for semantic search and AI context.

```bash
/index             # Index current project directory
/index /other/dir  # Index a different directory
```

### `/search <query>` (aliases: `/find`, `/f`)
Search the indexed project using keyword matching.

```bash
/search authentication
/search database connection
/search API routes
```

### `/grep <pattern>` (aliases: `/rg`)
Search file *contents* with a text or regex pattern.

```bash
/grep useEffect
/grep "async function" --regex
/grep TODO --case-sensitive
```

---

## Git

### `/git [subcommand]` (alias: `/g`)

```bash
/git                   # Show status (default)
/git status            # Working tree status
/git diff              # Unstaged changes
/git diff --cached     # Staged changes
/git log               # Last 10 commits
/git log 20            # Last 20 commits
/git commit            # Stage all + auto-generate commit message
/git commit "message"  # Stage all + use given message
/git branch            # List branches
/git checkout main     # Switch to branch
/git checkout -b feat  # Create and switch to new branch
/git push              # Push current branch to origin
/git pull              # Pull from origin
```

---

## GitHub

### `/github [subcommand]` (alias: `/gh`)

```bash
/github auth <token>          # Authenticate with Personal Access Token
/github repos                 # List your repositories
/github clone owner/repo      # Clone a repository
/github clone owner/repo dir  # Clone into specific directory
/github pr                    # List pull requests for current repo
```

**Required PAT scopes:** `repo`, `read:user`

---

## Shell Commands

### `/run <command>` (aliases: `/exec`, `/shell`)
Execute a shell command in the project directory.

```bash
/run npm install
/run npm test
/run python -m pytest
/run cargo build
```

Output is shown in real-time. Commands are blocked if they match known
destructive patterns.
