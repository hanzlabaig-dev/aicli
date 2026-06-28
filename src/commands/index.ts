import { commandRegistry } from './registry';
import {
  HelpCommand, ConfigCommand, ProviderCommand, ModelsCommand,
  HistoryCommand, SessionCommand, ClearCommand, ResetCommand,
  GitCommand, GitHubCommand, IndexCommand, SearchCommand,
  ThemeCommand, VersionCommand, ExitCommand,
  PinCommand, RunCommand, GrepCommand,
} from './implementations';

export function registerCommands(): void {
  [
    new HelpCommand(),
    new ConfigCommand(),
    new ProviderCommand(),
    new ModelsCommand(),
    new HistoryCommand(),
    new SessionCommand(),
    new ClearCommand(),
    new ResetCommand(),
    new GitCommand(),
    new GitHubCommand(),
    new IndexCommand(),
    new SearchCommand(),
    new GrepCommand(),
    new ThemeCommand(),
    new VersionCommand(),
    new PinCommand(),
    new RunCommand(),
    new ExitCommand(),
  ].forEach((cmd) => commandRegistry.register(cmd));
}

export { commandRegistry };
