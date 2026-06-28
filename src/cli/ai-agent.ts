import chalk from 'chalk';
import enquirer from 'enquirer';
import { fileTools } from '../tools/file';
import { projectIndexer } from '../indexer/project';
import { searchFiles, findFiles } from '../tools/search';
import { execCommand } from '../tools/executor';
import { snippetStore } from '../memory/snippets';
import { printDivider, renderDiff, printSuccess, printWarning, printError } from '../utils/terminal';
import { logger } from '../utils/logger';
import { CLIState } from './state';

export interface ToolCall {
  tool: string;
  path?: string;
  content?: string;
  newPath?: string;
  query?: string;
  command?: string;
  regex?: boolean;
  caseSensitive?: boolean;
  extensions?: string[];
}

/** Parse tool call blocks embedded in AI responses: ```tool\n{...}\n``` */
export function parseToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const pattern = /```tool\n([\s\S]*?)\n```/g;
  let match;
  while ((match = pattern.exec(response)) !== null) {
    try {
      calls.push(JSON.parse(match[1]) as ToolCall);
    } catch { /* skip malformed */ }
  }
  return calls;
}

/** Execute tool calls with user confirmation for destructive actions */
export async function executeToolCalls(calls: ToolCall[], state: CLIState): Promise<string[]> {
  const results: string[] = [];

  for (const call of calls) {
    try {
      switch (call.tool) {
        /* ── read_file ─────────────────────────────────────────────── */
        case 'read_file': {
          if (!call.path) { results.push('Error: path required'); break; }
          const content = fileTools.readFile(call.path);
          results.push(`File: ${call.path}\n\`\`\`\n${content}\n\`\`\``);
          break;
        }

        /* ── create_file / edit_file ───────────────────────────────── */
        case 'create_file':
        case 'edit_file': {
          if (!call.path || call.content === undefined) {
            results.push('Error: path and content required'); break;
          }
          const isEdit = call.tool === 'edit_file' && fileTools.fileExists(call.path);
          const action = isEdit ? 'Edit' : 'Create';

          printDivider(`${action}: ${call.path}`);
          const diff = fileTools.generateDiff(call.path, call.content);
          console.log(diff);

          const { confirmed } = await (enquirer as any).prompt({
            type: 'confirm',
            name: 'confirmed',
            message: `Apply ${action.toLowerCase()} to ${call.path}?`,
            initial: true,
          });

          if (confirmed) {
            fileTools.writeFile(call.path, call.content);
            printSuccess(`${action}d: ${call.path}`);
            results.push(`${action}d file: ${call.path}`);
          } else {
            printWarning(`Skipped: ${call.path}`);
            results.push(`Skipped: ${call.path}`);
          }
          break;
        }

        /* ── delete_file ───────────────────────────────────────────── */
        case 'delete_file': {
          if (!call.path) { results.push('Error: path required'); break; }
          const { confirmed } = await (enquirer as any).prompt({
            type: 'confirm',
            name: 'confirmed',
            message: chalk.red(`Delete ${call.path}? This cannot be undone.`),
            initial: false,
          });
          if (confirmed) {
            fileTools.deleteFile(call.path);
            printSuccess(`Deleted: ${call.path}`);
            results.push(`Deleted: ${call.path}`);
          } else {
            results.push(`Deletion skipped: ${call.path}`);
          }
          break;
        }

        /* ── rename_file ───────────────────────────────────────────── */
        case 'rename_file': {
          if (!call.path || !call.newPath) { results.push('Error: path and newPath required'); break; }
          const { confirmed } = await (enquirer as any).prompt({
            type: 'confirm',
            name: 'confirmed',
            message: `Rename ${call.path} → ${call.newPath}?`,
            initial: true,
          });
          if (confirmed) {
            fileTools.renameFile(call.path, call.newPath);
            printSuccess(`Renamed: ${call.path} → ${call.newPath}`);
            results.push(`Renamed: ${call.path} → ${call.newPath}`);
          }
          break;
        }

        /* ── list_files ────────────────────────────────────────────── */
        case 'list_files': {
          const files = fileTools.listFiles(call.path || '.');
          results.push(`Files in ${call.path || '.'}:\n${files.join('\n')}`);
          break;
        }

        /* ── search_text ───────────────────────────────────────────── */
        case 'search_text': {
          if (!call.query) { results.push('Error: query required'); break; }
          const matches = await searchFiles(state.projectPath, call.query, {
            regex: call.regex,
            caseSensitive: call.caseSensitive,
            includeExtensions: call.extensions,
            maxResults: 30,
            contextLines: 2,
          });
          if (matches.length === 0) {
            results.push(`No matches for: ${call.query}`);
          } else {
            const lines = matches.map(
              (m) => `${m.file}:${m.line}:${m.column}  ${m.text}`
            );
            results.push(`Search "${call.query}" — ${matches.length} matches:\n${lines.join('\n')}`);
          }
          break;
        }

        /* ── find_files ────────────────────────────────────────────── */
        case 'find_files': {
          if (!call.query) { results.push('Error: query required'); break; }
          const found = await findFiles(state.projectPath, call.query);
          results.push(`Files matching "${call.query}":\n${found.slice(0, 50).join('\n')}`);
          break;
        }

        /* ── search_project ────────────────────────────────────────── */
        case 'search_project': {
          if (!call.query) { results.push('Error: query required'); break; }
          if (!state.isIndexed) {
            results.push('Project not indexed. Ask the user to run /index first.');
            break;
          }
          const found = projectIndexer.search(call.query, 20);
          results.push(
            `Semantic search "${call.query}":\n${found.map((f) => f.relativePath).join('\n')}`
          );
          break;
        }

        /* ── run_command ───────────────────────────────────────────── */
        case 'run_command': {
          if (!call.command) { results.push('Error: command required'); break; }

          const { confirmed } = await (enquirer as any).prompt({
            type: 'confirm',
            name: 'confirmed',
            message: `Run command: ${chalk.cyan(call.command)}`,
            initial: true,
          });

          if (!confirmed) { results.push(`Command skipped: ${call.command}`); break; }

          console.log(chalk.gray(`$ ${call.command}`));
          const result = await execCommand(call.command, state.projectPath);
          if (result.timedOut) {
            results.push(`Command timed out: ${call.command}`);
          } else {
            const out = [
              result.stdout && `stdout:\n${result.stdout}`,
              result.stderr && `stderr:\n${result.stderr}`,
              `exit code: ${result.exitCode}`,
            ].filter(Boolean).join('\n');
            results.push(out);
            if (result.stdout) process.stdout.write(result.stdout);
            if (result.stderr) process.stderr.write(chalk.yellow(result.stderr));
          }
          break;
        }

        /* ── pin_snippet ───────────────────────────────────────────── */
        case 'pin_snippet': {
          if (!call.query || !call.content) { results.push('Error: query (label) and content required'); break; }
          const snip = snippetStore.add(call.query, call.content, call.path);
          results.push(`Pinned snippet "${snip.label}" (${snip.id})`);
          break;
        }

        default:
          logger.debug('Unknown tool call', { tool: call.tool });
          results.push(`Unknown tool: ${call.tool}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`Error in ${call.tool}: ${msg}`);
      logger.error('Tool call failed', { call, err });
      printError(`Tool error (${call.tool}): ${msg}`);
    }
  }

  return results;
}

/** Build the system prompt injected before every chat request */
export function buildSystemPrompt(state: CLIState): string {
  const ctx = projectIndexer.getContext();
  const fileTree = state.isIndexed ? projectIndexer.getFileTree() : null;
  const pinnedSnippets = snippetStore.renderForSystemPrompt();

  const parts = [
    `You are AICLI, a professional AI coding assistant running in the terminal.`,
    `You help developers read, create, edit, debug, and understand code.`,
    `You are direct, precise, and professional. Use Markdown for code.`,
    ``,
    `Working directory: ${state.projectPath}`,
  ];

  if (ctx) {
    parts.push(`Project language(s): ${ctx.language.join(', ')}`);
    if (ctx.framework)      parts.push(`Framework: ${ctx.framework}`);
    if (ctx.packageManager) parts.push(`Package manager: ${ctx.packageManager}`);
  }

  if (fileTree) {
    parts.push(`\nProject file tree (truncated):\n${fileTree.slice(0, 4000)}`);
  }

  parts.push(`
## Available Tools

When you need to act on the filesystem or run commands, emit one or more tool
call blocks. Each block is parsed and executed with user confirmation before
any destructive change is applied.

\`\`\`tool
{"tool": "read_file", "path": "src/index.ts"}
\`\`\`

\`\`\`tool
{"tool": "create_file", "path": "src/utils.ts", "content": "// content"}
\`\`\`

\`\`\`tool
{"tool": "edit_file", "path": "src/index.ts", "content": "// full new content"}
\`\`\`

\`\`\`tool
{"tool": "delete_file", "path": "src/old.ts"}
\`\`\`

\`\`\`tool
{"tool": "rename_file", "path": "old.ts", "newPath": "new.ts"}
\`\`\`

\`\`\`tool
{"tool": "list_files", "path": "src"}
\`\`\`

\`\`\`tool
{"tool": "search_text", "query": "useEffect", "extensions": ["ts", "tsx"]}
\`\`\`

\`\`\`tool
{"tool": "find_files", "query": "auth"}
\`\`\`

\`\`\`tool
{"tool": "search_project", "query": "database connection"}
\`\`\`

\`\`\`tool
{"tool": "run_command", "command": "npm test"}
\`\`\`

\`\`\`tool
{"tool": "pin_snippet", "query": "Auth type", "content": "type User = {...}", "path": "typescript"}
\`\`\`

Rules:
- Always read a file before editing it if you don't already have its contents.
- Show a brief plan before emitting multiple tool calls.
- Never guess at file contents — read them first.
- For edits, always provide the COMPLETE new file content, not just the changed lines.`);

  if (pinnedSnippets) {
    parts.push(pinnedSnippets);
  }

  return parts.join('\n');
}
