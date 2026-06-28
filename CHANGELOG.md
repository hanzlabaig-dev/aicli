# Changelog

All notable changes to AICLI are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-06-28

### Added
- Interactive terminal REPL with tab-completion and command history
- Multi-provider support: OpenRouter, Anthropic, OpenAI, Google Gemini, Ollama
- Real-time streaming AI responses written directly to stdout
- Project indexer with language/framework detection and keyword search
- File operations: read, create, edit, rename, delete — all with diff preview and confirmation
- Text search (`/grep`) with regex and case-sensitivity options
- Shell command runner (`/run`) with timeout and safety guards
- Git integration: status, diff, log, commit (with auto-generated messages), branch, push, pull
- GitHub integration: auth, repos, clone, pull requests
- Session management: create, save, load, delete, export to Markdown
- Context windowing (`ContextManager`) to stay within provider token limits
- Pinned snippets (`/pin`) that inject persistent context into every request
- Slash commands: `/help`, `/config`, `/provider`, `/models`, `/history`, `/session`,
  `/clear`, `/reset`, `/git`, `/github`, `/index`, `/search`, `/grep`, `/pin`, `/run`,
  `/theme`, `/version`, `/exit`
- Secure API key handling — keys never appear in logs or error output
- Winston logging to `~/.aicli/logs/` with rotation
- GitHub Actions CI: tests on Ubuntu / Windows / macOS × Node 18/20/22
- CodeQL security scanning
- Comprehensive documentation in `docs/`
- Full unit and integration test suite
