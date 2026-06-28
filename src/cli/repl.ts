import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { configManager } from '../config/manager';
import { providerRegistry } from '../providers/registry';
import { sessionManager } from '../session/manager';
import { commandRegistry } from '../commands/registry';
import { contextManager } from '../memory/context';
import {
  printBanner, printDivider, printError, printInfo, printWarning,
  renderMarkdown, SYMBOLS, COLORS,
} from '../utils/terminal';
import { parseToolCalls, executeToolCalls, buildSystemPrompt } from './ai-agent';
import { gitIntegration } from '../git/integration';
import { projectIndexer } from '../indexer/project';
import { fileTools } from '../tools/file';
import { CLIState, createInitialState } from './state';
import { logger } from '../utils/logger';
import { Message } from '../config/types';
import path from 'path';

export class REPL {
  private rl: readline.Interface;
  private state: CLIState;

  constructor(projectPath: string) {
    const cfg = configManager.get();
    const model = providerRegistry.getActiveModel();

    this.state = createInitialState(
      path.resolve(projectPath),
      cfg.activeProvider,
      model
    );

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: cfg.historySize,
      completer: this.completer.bind(this),
    });

    // Create initial session
    sessionManager.getOrCreate(this.state.projectPath);
    fileTools.setWorkingDir(this.state.projectPath);
  }

  private completer(line: string): [string[], string] {
    const commands = [
      '/help', '/config', '/provider', '/models', '/history', '/session',
      '/clear', '/reset', '/git', '/github', '/index', '/search',
      '/theme', '/version', '/exit',
    ];
    if (line.startsWith('/')) {
      const hits = commands.filter((c) => c.startsWith(line));
      return [hits.length ? hits : commands, line];
    }
    return [[], line];
  }

  private getPrompt(): string {
    const model = this.state.currentModel.split('/').pop()?.slice(0, 20) ?? '';
    const indexed = this.state.isIndexed ? chalk.green('◉') : chalk.gray('◎');
    const git = chalk.gray('git');
    return `${indexed} ${chalk.cyan(this.state.currentProvider)}${chalk.gray(':')}${chalk.dim(model)} ${chalk.bold.green('›')} `;
  }

  private async handleCommand(input: string): Promise<boolean> {
    if (!input.startsWith('/')) return false;

    const parts = input.slice(1).split(/\s+/);
    const cmdName = parts[0];
    const args = parts.slice(1);

    const command = commandRegistry.find(cmdName);
    if (!command) {
      printError(`Unknown command: /${cmdName}. Type /help for commands.`);
      return true;
    }

    try {
      const result = await command.execute(args, this.state);
      if (result.message) console.log(chalk.gray(result.message));
      if (result.error)   printError(result.error);
      if (result.exit) {
        this.rl.close();
        process.exit(0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      printError(`Command failed: ${msg}`);
      logger.error('Command execution failed', { cmd: cmdName, err });
    }

    return true;
  }

  private async handleChat(userInput: string): Promise<void> {
    sessionManager.addMessage('user', userInput);

    const provider = providerRegistry.getActive();
    if (!provider.isConfigured() && this.state.currentProvider !== 'ollama') {
      printError(
        `${provider.displayName} is not configured. ` +
        `Run: /config set provider.${this.state.currentProvider}.apiKey <key>`
      );
      return;
    }

    const systemPrompt = buildSystemPrompt(this.state);
    contextManager.setSystemPromptTokens(Math.ceil(systemPrompt.length / 4));

    // Trim messages to fit context window
    const allMessages = sessionManager.getMessages();
    const trimmed = contextManager.trim(allMessages);
    if (trimmed.length < allMessages.length) {
      printWarning(
        `Context trimmed: showing ${trimmed.length}/${allMessages.length} messages to stay within token limit.`
      );
    }

    const cfg = configManager.get();
    if (cfg.streamingEnabled) {
      await this.streamResponse(systemPrompt, trimmed);
    } else {
      await this.singleResponse(systemPrompt, trimmed);
    }
  }

  private async streamResponse(systemPrompt: string, messages: Message[]): Promise<void> {
    process.stdout.write(`\n${SYMBOLS.ai} `);

    let fullResponse = '';

    try {
      const stream = providerRegistry.getActive().chatStream({
        model: this.state.currentModel,
        messages,
        systemPrompt,
        maxTokens: 4096,
      });

      for await (const chunk of stream) {
        if (chunk.content) {
          process.stdout.write(chunk.content);
          fullResponse += chunk.content;
        }
        if (chunk.done) break;
      }

      console.log('\n');

      // Handle tool calls
      const toolCalls = parseToolCalls(fullResponse);
      if (toolCalls.length > 0) {
        printDivider('Tool Calls');
        const results = await executeToolCalls(toolCalls, this.state);
        sessionManager.addMessage('assistant', fullResponse);
        if (results.length > 0) {
          // Feed tool results back to AI for a follow-up response
          const toolMsg = `Tool results:\n${results.join('\n\n')}`;
          sessionManager.addMessage('user', toolMsg);
          await this.streamResponse(systemPrompt, sessionManager.getMessages());
        }
      } else {
        sessionManager.addMessage('assistant', fullResponse);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      printError(`\nAI Error: ${msg}`);
      logger.error('Stream failed', { err });
    }
  }

  private async singleResponse(systemPrompt: string, messages: Message[]): Promise<void> {
    const spinner = ora({ text: 'Thinking…', color: 'cyan' }).start();

    try {
      const response = await providerRegistry.getActive().chat({
        model: this.state.currentModel,
        messages,
        systemPrompt,
        maxTokens: 4096,
      });

      spinner.stop();
      console.log(`\n${SYMBOLS.ai}`);
      console.log(renderMarkdown(response));

      const toolCalls = parseToolCalls(response);
      if (toolCalls.length > 0) {
        printDivider('Tool Calls');
        const results = await executeToolCalls(toolCalls, this.state);
        sessionManager.addMessage('assistant', response);
        if (results.length > 0) {
          sessionManager.addMessage('user', `Tool results:\n${results.join('\n\n')}`);
          await this.singleResponse(systemPrompt, sessionManager.getMessages());
        }
      } else {
        sessionManager.addMessage('assistant', response);
      }
    } catch (err) {
      spinner.fail('Failed to get response');
      const msg = err instanceof Error ? err.message : String(err);
      printError(msg);
      logger.error('Chat failed', { err });
    }
  }

  async start(): Promise<void> {
    printBanner();

    // Auto-init Git (best effort)
    const gitOk = await gitIntegration.init(this.state.projectPath);
    if (gitOk) {
      const branch = await gitIntegration.getCurrentBranch();
      console.log(chalk.gray(`  git: ${branch}`));
    }

    // Auto-index project
    if (configManager.get().autoIndex) {
      const spinner = ora({
        text: 'Indexing project…',
        color: 'cyan',
        spinner: 'dots',
      }).start();
      try {
        const idx = await projectIndexer.index(this.state.projectPath, true);
        this.state.isIndexed = true;
        spinner.succeed(chalk.gray(`Indexed ${idx.files.length} files`));
        if (idx.context.framework)      console.log(chalk.gray(`  framework: ${idx.context.framework}`));
        if (idx.context.packageManager) console.log(chalk.gray(`  pkg mgr:   ${idx.context.packageManager}`));
      } catch {
        spinner.warn(chalk.gray('Indexing skipped'));
      }
    }

    console.log(chalk.gray(`  provider: ${this.state.currentProvider} | model: ${this.state.currentModel}`));
    console.log(chalk.gray(`  Type /help for commands\n`));

    this.prompt();
  }

  private prompt(): void {
    if (this.state.exitRequested) return;

    this.rl.question(this.getPrompt(), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        this.prompt();
        return;
      }

      try {
        const wasCommand = await this.handleCommand(trimmed);
        if (!wasCommand) {
          await this.handleChat(trimmed);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        printError(`Unexpected error: ${msg}`);
        logger.error('REPL error', { err });
      }

      if (!this.state.exitRequested) {
        this.prompt();
      }
    });

    this.rl.on('SIGINT', () => {
      console.log('\n' + chalk.gray('Ctrl+C — type /exit to quit or press again'));
      // Second Ctrl+C exits immediately
      process.once('SIGINT', () => {
        console.log(chalk.gray('\nBye!'));
        process.exit(0);
      });
      this.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n' + chalk.gray('Goodbye!'));
      process.exit(0);
    });
  }
}
