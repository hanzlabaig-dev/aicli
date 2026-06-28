import { CLIState } from '../cli/state';

export interface CommandResult {
  handled: boolean;
  message?: string;
  error?: string;
  exit?: boolean;
}

export abstract class BaseCommand {
  abstract readonly name: string;
  abstract readonly description: string;
  readonly usage?: string;
  readonly aliases?: string[];

  abstract execute(args: string[], state: CLIState): Promise<CommandResult>;

  matches(input: string): boolean {
    const cmd = input.split(' ')[0].replace(/^\//, '');
    return cmd === this.name || (this.aliases || []).includes(cmd);
  }
}

class CommandRegistry {
  private commands: Map<string, BaseCommand> = new Map();

  register(command: BaseCommand): void {
    this.commands.set(command.name, command);
    (command.aliases || []).forEach((alias) => this.commands.set(alias, command));
  }

  find(name: string): BaseCommand | undefined {
    return this.commands.get(name.replace(/^\//, ''));
  }

  findByInput(input: string): BaseCommand | undefined {
    const cmd = input.trim().split(/\s+/)[0].replace(/^\//, '');
    return this.commands.get(cmd);
  }

  all(): BaseCommand[] {
    const unique = new Set<BaseCommand>();
    this.commands.forEach((cmd) => unique.add(cmd));
    return [...unique];
  }
}

export const commandRegistry = new CommandRegistry();
