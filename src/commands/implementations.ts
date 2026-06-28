import chalk from 'chalk';
import { BaseCommand, CommandResult } from './registry';
import { CLIState } from '../cli/state';
import { configManager } from '../config/manager';
import { providerRegistry } from '../providers/registry';
import { sessionManager } from '../session/manager';
import { projectIndexer } from '../indexer/project';
import { gitIntegration } from '../git/integration';
import { githubIntegration } from '../github/integration';
import { fileTools } from '../tools/file';
import { getLogDir } from '../utils/logger';
import {
  printSuccess, printError, printInfo, printWarning,
  printDivider, formatTable, renderDiff, renderMarkdown, COLORS
} from '../utils/terminal';
import { ProviderName } from '../config/types';
import enquirer from 'enquirer';

// ─── /help ────────────────────────────────────────────────────────────────────
export class HelpCommand extends BaseCommand {
  readonly name = 'help';
  readonly description = 'Show available commands';
  readonly aliases = ['h', '?'];
  readonly usage = '/help [command]';

  async execute(_args: string[], _state: CLIState): Promise<CommandResult> {
    const commands = [
      ['/help', 'Show this help message'],
      ['/config', 'View or edit configuration'],
      ['/provider <name>', 'Switch AI provider (openrouter|anthropic|openai|gemini|ollama)'],
      ['/models [filter]', 'Browse and select a model'],
      ['/history', 'View conversation history'],
      ['/session', 'Manage sessions (list|load|save|delete|export)'],
      ['/clear', 'Clear conversation history'],
      ['/reset', 'Reset to a new session'],
      ['/git [cmd]', 'Git operations (status|diff|log|commit|branch|push|pull)'],
      ['/github [cmd]', 'GitHub operations (auth|repos|clone|pr)'],
      ['/index [path]', 'Index current project for search'],
      ['/search <query>', 'Search indexed project files'],
      ['/theme <name>', 'Change theme (dark|light)'],
      ['/version', 'Show version information'],
      ['/exit', 'Exit the application'],
    ];

    printDivider('AICLI Commands');
    console.log(formatTable(['Command', 'Description'], commands));
    console.log('\n' + chalk.gray('Tip: You can also ask the AI to read, create, or edit files directly.'));
    return { handled: true };
  }
}

// ─── /config ──────────────────────────────────────────────────────────────────
export class ConfigCommand extends BaseCommand {
  readonly name = 'config';
  readonly description = 'View or edit configuration';
  readonly usage = '/config [set <key> <value>]';
  readonly aliases = ['cfg'];

  async execute(args: string[], _state: CLIState): Promise<CommandResult> {
    if (args[0] === 'set' && args[1] && args[2]) {
      const [, key, value] = args;
      if (key.startsWith('provider.')) {
        const parts = key.split('.');
        const providerName = parts[1] as ProviderName;
        const field = parts[2];
        if (field === 'apiKey' || field === 'key') {
          configManager.setApiKey(providerName, value);
          printSuccess(`API key set for ${providerName}`);
        } else {
          configManager.setProvider(providerName, { [field]: value });
          printSuccess(`${key} = ${value}`);
        }
        return { handled: true };
      }
      return { handled: true, error: `Unknown config key: ${key}` };
    }

    const cfg = configManager.get();
    printDivider('Configuration');
    console.log(chalk.cyan('Active Provider:'), chalk.bold(cfg.activeProvider));
    console.log(chalk.cyan('Config Dir:'), chalk.gray(configManager.getConfigDir()));
    console.log(chalk.cyan('Log Dir:'), chalk.gray(getLogDir()));
    console.log(chalk.cyan('Streaming:'), cfg.streamingEnabled ? chalk.green('on') : chalk.red('off'));
    console.log(chalk.cyan('Auto-Index:'), cfg.autoIndex ? chalk.green('on') : chalk.red('off'));
    console.log();

    printDivider('Providers');
    for (const [name, pcfg] of Object.entries(cfg.providers)) {
      const hasKey = !!(configManager.getApiKey(name as ProviderName));
      const status = hasKey ? chalk.green('✓ configured') : chalk.red('✗ no API key');
      console.log(`  ${chalk.bold(name.padEnd(12))} ${status}  ${chalk.gray(pcfg.defaultModel || '')}`);
    }

    console.log(chalk.gray('\nUsage: /config set provider.<name>.apiKey <key>'));
    return { handled: true };
  }
}

// ─── /provider ────────────────────────────────────────────────────────────────
export class ProviderCommand extends BaseCommand {
  readonly name = 'provider';
  readonly description = 'Switch AI provider';
  readonly usage = '/provider <name>';
  readonly aliases = ['p'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    const VALID: ProviderName[] = ['openrouter', 'anthropic', 'openai', 'gemini', 'ollama'];

    if (!args[0]) {
      printDivider('Providers');
      for (const entry of providerRegistry.list()) {
        const active = entry.name === state.currentProvider ? chalk.cyan(' ◄ active') : '';
        const status = entry.configured ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${chalk.bold(entry.name.padEnd(12))} ${entry.provider.displayName}${active}`);
      }
      console.log(chalk.gray('\nUsage: /provider <name>'));
      return { handled: true };
    }

    const name = args[0] as ProviderName;
    if (!VALID.includes(name)) {
      return { handled: true, error: `Unknown provider: ${name}. Choose from: ${VALID.join(', ')}` };
    }

    const provider = providerRegistry.get(name);
    if (!provider.isConfigured() && name !== 'ollama') {
      printWarning(`${name} has no API key. Set one with: /config set provider.${name}.apiKey <key>`);
    }

    configManager.setActiveProvider(name);
    state.currentProvider = name;
    state.currentModel = configManager.get().providers[name].defaultModel || '';
    sessionManager.updateProvider(name, state.currentModel);
    printSuccess(`Switched to ${provider.displayName} (${state.currentModel})`);
    return { handled: true };
  }
}

// ─── /models ──────────────────────────────────────────────────────────────────
export class ModelsCommand extends BaseCommand {
  readonly name = 'models';
  readonly description = 'Browse and select a model';
  readonly usage = '/models [filter]';
  readonly aliases = ['model', 'm'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    const filter = args.join(' ').toLowerCase();
    const provider = providerRegistry.getActive();

    printInfo(`Fetching models from ${provider.displayName}...`);

    let models = await provider.listModels();
    if (filter) {
      models = models.filter(
        (m) =>
          m.id.toLowerCase().includes(filter) ||
          m.name.toLowerCase().includes(filter) ||
          m.tags?.some((t) => t.includes(filter))
      );
    }

    if (models.length === 0) {
      return { handled: true, message: 'No models found matching that filter.' };
    }

    // Show interactive selection
    const choices = models.slice(0, 50).map((m) => ({
      name: m.id,
      message: `${m.name} ${m.tags ? chalk.gray('[' + m.tags.join(', ') + ']') : ''} ${m.contextLength ? chalk.blue(Math.round(m.contextLength / 1000) + 'k ctx') : ''}`,
      value: m.id,
    }));

    try {
      const { model } = await (enquirer as any).prompt({
        type: 'autocomplete',
        name: 'model',
        message: 'Select a model:',
        choices,
        limit: 15,
      });

      configManager.setDefaultModel(state.currentProvider, model);
      state.currentModel = model;
      sessionManager.updateProvider(state.currentProvider, model);
      printSuccess(`Switched to model: ${model}`);
    } catch {
      // User cancelled
    }

    return { handled: true };
  }
}

// ─── /history ─────────────────────────────────────────────────────────────────
export class HistoryCommand extends BaseCommand {
  readonly name = 'history';
  readonly description = 'View conversation history';
  readonly usage = '/history [n]';
  readonly aliases = ['hist'];

  async execute(args: string[], _state: CLIState): Promise<CommandResult> {
    const n = parseInt(args[0] || '10', 10);
    const messages = sessionManager.getMessages();
    const recent = messages.slice(-n);

    if (recent.length === 0) {
      return { handled: true, message: 'No messages in current session.' };
    }

    printDivider(`Last ${recent.length} Messages`);
    for (const msg of recent) {
      const role = msg.role === 'user' ? chalk.bold.green('You') : chalk.bold.cyan('AI');
      const time = chalk.gray(new Date(msg.timestamp).toLocaleTimeString());
      console.log(`\n${role} ${time}`);
      console.log(chalk.dim(msg.content.slice(0, 300) + (msg.content.length > 300 ? '...' : '')));
    }
    console.log();
    return { handled: true };
  }
}

// ─── /session ─────────────────────────────────────────────────────────────────
export class SessionCommand extends BaseCommand {
  readonly name = 'session';
  readonly description = 'Manage sessions';
  readonly usage = '/session [list|load <id>|delete <id>|export]';
  readonly aliases = ['sess', 's'];

  async execute(args: string[], _state: CLIState): Promise<CommandResult> {
    const [subcmd, ...rest] = args;

    if (!subcmd || subcmd === 'list') {
      const sessions = sessionManager.listSessions();
      if (sessions.length === 0) return { handled: true, message: 'No saved sessions.' };
      printDivider('Sessions');
      const rows = sessions.map((s) => [
        s.id.slice(0, 8),
        s.name.slice(0, 30),
        s.provider,
        String(s.messages.length),
        new Date(s.updatedAt).toLocaleString(),
      ]);
      console.log(formatTable(['ID', 'Name', 'Provider', 'Messages', 'Updated'], rows));
      return { handled: true };
    }

    if (subcmd === 'load') {
      const id = rest[0];
      if (!id) return { handled: true, error: 'Usage: /session load <id>' };
      const session = sessionManager.loadSession(id);
      if (!session) return { handled: true, error: `Session not found: ${id}` };
      printSuccess(`Loaded session: ${session.name} (${session.messages.length} messages)`);
      return { handled: true };
    }

    if (subcmd === 'delete') {
      const id = rest[0];
      if (!id) return { handled: true, error: 'Usage: /session delete <id>' };
      const deleted = sessionManager.deleteSession(id);
      if (deleted) printSuccess(`Session deleted: ${id}`);
      else printError(`Session not found: ${id}`);
      return { handled: true };
    }

    if (subcmd === 'export') {
      const current = sessionManager.getCurrent();
      if (!current) return { handled: true, error: 'No active session to export.' };
      const md = sessionManager.exportSession(current.id);
      if (md) {
        const filename = `session-${current.id.slice(0, 8)}.md`;
        require('fs-extra').writeFileSync(filename, md, 'utf-8');
        printSuccess(`Session exported to: ${filename}`);
      }
      return { handled: true };
    }

    return { handled: true, error: 'Unknown subcommand. Use: list, load, delete, export' };
  }
}

// ─── /clear ───────────────────────────────────────────────────────────────────
export class ClearCommand extends BaseCommand {
  readonly name = 'clear';
  readonly description = 'Clear conversation history';
  readonly aliases = ['cls'];

  async execute(_args: string[], _state: CLIState): Promise<CommandResult> {
    sessionManager.clearMessages();
    console.clear();
    printSuccess('Conversation cleared.');
    return { handled: true };
  }
}

// ─── /reset ───────────────────────────────────────────────────────────────────
export class ResetCommand extends BaseCommand {
  readonly name = 'reset';
  readonly description = 'Start a new session';

  async execute(_args: string[], state: CLIState): Promise<CommandResult> {
    sessionManager.createSession(undefined, state.projectPath);
    console.clear();
    printSuccess('Started a new session.');
    return { handled: true };
  }
}

// ─── /git ─────────────────────────────────────────────────────────────────────
export class GitCommand extends BaseCommand {
  readonly name = 'git';
  readonly description = 'Git operations';
  readonly usage = '/git [status|diff|log|commit|branch|push|pull]';
  readonly aliases = ['g'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    if (!gitIntegration.isInitialized()) {
      const ok = await gitIntegration.init(state.projectPath);
      if (!ok) return { handled: true, error: 'Not a git repository.' };
    }

    const [subcmd, ...rest] = args;

    if (!subcmd || subcmd === 'status') {
      const status = await gitIntegration.status();
      printDivider('Git Status');
      console.log(chalk.cyan('Branch:'), chalk.bold(status.current));
      if (status.modified.length) console.log(chalk.yellow('Modified:'), status.modified.join(', '));
      if (status.not_added.length) console.log(chalk.red('Untracked:'), status.not_added.join(', '));
      if (status.created.length) console.log(chalk.green('Added:'), status.created.join(', '));
      if (status.deleted.length) console.log(chalk.red('Deleted:'), status.deleted.join(', '));
      if (status.isClean()) printSuccess('Working tree clean');
      return { handled: true };
    }

    if (subcmd === 'diff') {
      const diff = await gitIntegration.diff(rest[0] === '--cached');
      if (!diff) return { handled: true, message: 'No changes to show.' };
      console.log(renderDiff(diff));
      return { handled: true };
    }

    if (subcmd === 'log') {
      const log = await gitIntegration.log(parseInt(rest[0] || '10', 10));
      printDivider('Git Log');
      for (const entry of log.all) {
        console.log(
          chalk.yellow(entry.hash.slice(0, 7)),
          chalk.gray(new Date(entry.date).toLocaleDateString()),
          chalk.cyan(entry.author_name),
          entry.message
        );
      }
      return { handled: true };
    }

    if (subcmd === 'commit') {
      const message = rest.join(' ');
      if (!message) {
        // Auto-generate
        const diff = await gitIntegration.diff();
        const autoMsg = await gitIntegration.generateCommitMessage(diff || 'Update files');
        const { confirmed } = await (enquirer as any).prompt({
          type: 'confirm',
          name: 'confirmed',
          message: `Commit with message: "${autoMsg}"?`,
        });
        if (confirmed) {
          const hash = await gitIntegration.commit(autoMsg);
          printSuccess(`Committed: ${hash.slice(0, 7)}`);
        }
      } else {
        const hash = await gitIntegration.commit(message);
        printSuccess(`Committed: ${hash.slice(0, 7)}`);
      }
      return { handled: true };
    }

    if (subcmd === 'branch') {
      const branches = await gitIntegration.branches();
      printDivider('Branches');
      for (const b of branches.all) {
        const isCurrent = b === branches.current;
        console.log(isCurrent ? chalk.cyan('* ' + b) : chalk.gray('  ' + b));
      }
      return { handled: true };
    }

    if (subcmd === 'push') {
      printInfo('Pushing...');
      await gitIntegration.push();
      printSuccess('Pushed successfully.');
      return { handled: true };
    }

    if (subcmd === 'pull') {
      printInfo('Pulling...');
      await gitIntegration.pull();
      printSuccess('Pulled successfully.');
      return { handled: true };
    }

    if (subcmd === 'checkout') {
      const branch = rest[0];
      const create = rest.includes('-b');
      if (!branch) return { handled: true, error: 'Usage: /git checkout [-b] <branch>' };
      await gitIntegration.checkoutBranch(branch, create);
      printSuccess(`Switched to branch: ${branch}`);
      return { handled: true };
    }

    return { handled: true, error: `Unknown git subcommand: ${subcmd}` };
  }
}

// ─── /github ──────────────────────────────────────────────────────────────────
export class GitHubCommand extends BaseCommand {
  readonly name = 'github';
  readonly description = 'GitHub integration';
  readonly usage = '/github [auth|repos|clone|pr]';
  readonly aliases = ['gh'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    const [subcmd, ...rest] = args;

    if (subcmd === 'auth') {
      const token = rest[0];
      if (!token) return { handled: true, error: 'Usage: /github auth <personal-access-token>' };
      const user = await githubIntegration.authenticate(token);
      printSuccess(`Authenticated as ${user.login} (${user.name})`);
      return { handled: true };
    }

    if (!githubIntegration.isConfigured()) {
      return { handled: true, error: 'Not authenticated. Use: /github auth <token>' };
    }

    if (!subcmd || subcmd === 'repos') {
      printInfo('Fetching repositories...');
      const repos = await githubIntegration.listRepos();
      printDivider('Your Repositories');
      const rows = repos.map((r) => [
        r.full_name,
        r.language || 'Unknown',
        String(r.stargazers_count),
        r.private ? 'Private' : 'Public',
        new Date(r.updated_at).toLocaleDateString(),
      ]);
      console.log(formatTable(['Repository', 'Language', '★', 'Visibility', 'Updated'], rows));
      return { handled: true };
    }

    if (subcmd === 'clone') {
      const repoName = rest[0];
      if (!repoName) return { handled: true, error: 'Usage: /github clone <owner/repo>' };
      const [owner, repo] = repoName.split('/');
      const repoData = await githubIntegration.getRepo(owner, repo);
      const target = rest[1] || repo;
      printInfo(`Cloning ${repoData.clone_url}...`);
      await gitIntegration.clone(repoData.clone_url, target);
      printSuccess(`Cloned to ./${target}`);
      return { handled: true };
    }

    if (subcmd === 'pr') {
      const repoName = rest[0];
      if (!repoName) {
        const url = await gitIntegration.getRemoteUrl();
        if (!url) return { handled: true, error: 'No remote URL found. Specify: /github pr <owner/repo>' };
        const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
        if (!match) return { handled: true, error: 'Cannot parse GitHub URL from remote' };
        const [owner, repo] = match[1].split('/');
        const prs = await githubIntegration.listPullRequests(owner, repo);
        printDivider('Pull Requests');
        for (const pr of prs) {
          console.log(chalk.cyan(`#${pr.number}`), pr.title, chalk.gray(pr.state));
        }
        return { handled: true };
      }
      return { handled: true };
    }

    return { handled: true, error: `Unknown github subcommand: ${subcmd}` };
  }
}

// ─── /index ───────────────────────────────────────────────────────────────────
export class IndexCommand extends BaseCommand {
  readonly name = 'index';
  readonly description = 'Index project for semantic search';
  readonly usage = '/index [path]';

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    const targetPath = args[0] || state.projectPath;
    printInfo(`Indexing ${targetPath}...`);
    const idx = await projectIndexer.index(targetPath, true);
    state.isIndexed = true;
    state.projectPath = targetPath;
    fileTools.setWorkingDir(targetPath);
    printSuccess(`Indexed ${idx.files.length} files (${idx.context.language.join(', ')})`);
    if (idx.context.framework) printInfo(`Framework: ${idx.context.framework}`);
    if (idx.context.packageManager) printInfo(`Package Manager: ${idx.context.packageManager}`);
    return { handled: true };
  }
}

// ─── /search ──────────────────────────────────────────────────────────────────
export class SearchCommand extends BaseCommand {
  readonly name = 'search';
  readonly description = 'Search project files';
  readonly usage = '/search <query>';
  readonly aliases = ['find', 'f'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    if (!state.isIndexed) {
      printWarning('Project not indexed. Running /index first...');
      await projectIndexer.index(state.projectPath, true);
      state.isIndexed = true;
    }

    const query = args.join(' ');
    if (!query) return { handled: true, error: 'Usage: /search <query>' };

    const results = projectIndexer.search(query);
    if (results.length === 0) return { handled: true, message: `No results for: ${query}` };

    printDivider(`Search: "${query}" (${results.length} results)`);
    for (const r of results) {
      console.log(chalk.cyan(r.relativePath), chalk.gray(r.language || ''), chalk.dim(fileTools.resolvePath(r.relativePath)));
    }
    return { handled: true };
  }
}

// ─── /theme ───────────────────────────────────────────────────────────────────
export class ThemeCommand extends BaseCommand {
  readonly name = 'theme';
  readonly description = 'Change color theme';
  readonly usage = '/theme <dark|light>';

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    const theme = args[0];
    if (!theme || !['dark', 'light', 'system'].includes(theme)) {
      return { handled: true, error: 'Usage: /theme <dark|light|system>' };
    }
    state.theme = theme;
    configManager.set('theme', { ...configManager.get().theme, name: theme as 'dark' | 'light' | 'system' });
    printSuccess(`Theme set to: ${theme}`);
    return { handled: true };
  }
}

// ─── /version ─────────────────────────────────────────────────────────────────
export class VersionCommand extends BaseCommand {
  readonly name = 'version';
  readonly description = 'Show version information';
  readonly aliases = ['v', 'ver'];

  async execute(_args: string[], state: CLIState): Promise<CommandResult> {
    printDivider('AICLI Version Info');
    console.log(chalk.cyan('Version:'), '1.0.0');
    console.log(chalk.cyan('Node.js:'), process.version);
    console.log(chalk.cyan('Platform:'), process.platform);
    console.log(chalk.cyan('Provider:'), state.currentProvider);
    console.log(chalk.cyan('Model:'), state.currentModel);
    console.log(chalk.cyan('Project:'), state.projectPath);
    return { handled: true };
  }
}

// ─── /exit ────────────────────────────────────────────────────────────────────
export class ExitCommand extends BaseCommand {
  readonly name = 'exit';
  readonly description = 'Exit the application';
  readonly aliases = ['quit', 'q', 'bye'];

  async execute(_args: string[], state: CLIState): Promise<CommandResult> {
    state.exitRequested = true;
    return { handled: true, exit: true };
  }
}

// ─── /pin ─────────────────────────────────────────────────────────────────────
export class PinCommand extends BaseCommand {
  readonly name = 'pin';
  readonly description = 'Pin a code snippet to the AI context';
  readonly usage = '/pin [list|remove <id>|clear] OR /pin <label> (then paste)';

  async execute(args: string[], _state: CLIState): Promise<CommandResult> {
    const { snippetStore } = require('../memory/snippets');

    if (!args[0] || args[0] === 'list') {
      const snippets = snippetStore.list();
      if (snippets.length === 0) return { handled: true, message: 'No pinned snippets.' };
      printDivider('Pinned Snippets');
      for (const s of snippets) {
        console.log(
          chalk.cyan(s.id),
          chalk.bold(s.label),
          s.language ? chalk.gray(`[${s.language}]`) : '',
          chalk.dim(`${s.content.slice(0, 60)}…`)
        );
      }
      return { handled: true };
    }

    if (args[0] === 'remove') {
      const id = args[1];
      if (!id) return { handled: true, error: 'Usage: /pin remove <id>' };
      const ok = snippetStore.remove(id);
      if (ok) printSuccess(`Removed snippet: ${id}`);
      else printError(`Snippet not found: ${id}`);
      return { handled: true };
    }

    if (args[0] === 'clear') {
      snippetStore.clear();
      printSuccess('All pinned snippets cleared.');
      return { handled: true };
    }

    // /pin <label>  — read multiline content until user enters a blank line
    const label = args.join(' ');
    printInfo(`Paste content for "${label}", then enter a blank line to finish:`);
    const lines: string[] = [];
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    await new Promise<void>((resolve) => {
      rl.on('line', (line: string) => {
        if (line === '') { rl.close(); resolve(); }
        else lines.push(line);
      });
      rl.on('close', resolve);
    });
    const content = lines.join('\n');
    if (!content) return { handled: true, message: 'Nothing pinned (empty input).' };
    const snip = snippetStore.add(label, content);
    printSuccess(`Pinned "${label}" (${snip.id})`);
    return { handled: true };
  }
}

// ─── /run ─────────────────────────────────────────────────────────────────────
export class RunCommand extends BaseCommand {
  readonly name = 'run';
  readonly description = 'Execute a shell command in the project directory';
  readonly usage = '/run <command>';
  readonly aliases = ['exec', 'shell'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    const command = args.join(' ');
    if (!command) return { handled: true, error: 'Usage: /run <command>' };

    const { execCommand } = require('../tools/executor');
    printInfo(`$ ${command}`);
    const result = await execCommand(command, state.projectPath, 60_000);

    if (result.timedOut) {
      printError('Command timed out.');
    } else {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(chalk.yellow(result.stderr));
      const status = result.exitCode === 0
        ? chalk.green(`exit 0`)
        : chalk.red(`exit ${result.exitCode}`);
      console.log(chalk.gray(`[${status}]`));
    }
    return { handled: true };
  }
}

// ─── /search (text) ───────────────────────────────────────────────────────────
export class GrepCommand extends BaseCommand {
  readonly name = 'grep';
  readonly description = 'Search file contents with a text/regex pattern';
  readonly usage = '/grep <pattern> [--regex] [--case-sensitive]';
  readonly aliases = ['rg'];

  async execute(args: string[], state: CLIState): Promise<CommandResult> {
    const isRegex = args.includes('--regex');
    const caseSensitive = args.includes('--case-sensitive');
    const pattern = args.filter(a => !a.startsWith('--')).join(' ');

    if (!pattern) return { handled: true, error: 'Usage: /grep <pattern>' };

    const { searchFiles } = require('../tools/search');
    printInfo(`Searching for: ${pattern}`);
    const matches = await searchFiles(state.projectPath, pattern, {
      regex: isRegex,
      caseSensitive,
      maxResults: 50,
      contextLines: 1,
    });

    if (matches.length === 0) return { handled: true, message: `No matches for: ${pattern}` };

    printDivider(`${matches.length} match${matches.length === 1 ? '' : 'es'} — "${pattern}"`);
    for (const m of matches) {
      console.log(
        chalk.cyan(m.file) + chalk.gray(':') + chalk.yellow(String(m.line)) +
        '  ' + m.text
      );
    }
    return { handled: true };
  }
}
