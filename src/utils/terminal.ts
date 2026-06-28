import chalk from 'chalk';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { highlight } from 'cli-highlight';

// Configure marked with terminal renderer
marked.use(markedTerminal({
  code: (code: string, lang?: string) => {
    try {
      return highlight(code, { language: lang || 'plaintext', ignoreIllegals: true });
    } catch {
      return code;
    }
  },
  blockquote: (quote: string) => chalk.italic.gray(quote),
  heading: (text: string, level: number) => {
    const colors = [chalk.bold.cyan, chalk.bold.blue, chalk.bold.magenta, chalk.bold.yellow, chalk.bold.green, chalk.bold.white];
    const prefix = '#'.repeat(level) + ' ';
    return (colors[level - 1] || chalk.bold)(prefix + text) + '\n';
  },
}));

export const SYMBOLS = {
  success: chalk.green('✓'),
  error: chalk.red('✗'),
  warning: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  arrow: chalk.cyan('›'),
  bullet: chalk.gray('•'),
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  user: chalk.bold.green('You'),
  ai: chalk.bold.cyan('AI'),
  divider: chalk.gray('─'.repeat(process.stdout.columns || 80)),
};

export const COLORS = {
  primary: chalk.cyan,
  secondary: chalk.blue,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  muted: chalk.gray,
  bold: chalk.bold,
  dim: chalk.dim,
  highlight: chalk.bgCyan.black,
};

export function renderMarkdown(text: string): string {
  try {
    return marked(text) as string;
  } catch {
    return text;
  }
}

export function renderCodeBlock(code: string, lang?: string): string {
  const border = chalk.gray('─'.repeat(Math.min(process.stdout.columns - 4 || 76, 76)));
  const langLabel = lang ? chalk.bold.cyan(` ${lang} `) : '';
  let highlighted: string;
  try {
    highlighted = highlight(code, { language: lang || 'plaintext', ignoreIllegals: true });
  } catch {
    highlighted = code;
  }
  return `\n${chalk.gray('┌─')}${langLabel}${border}\n${highlighted}\n${chalk.gray('└─')}${border}\n`;
}

export function renderDiff(diff: string): string {
  return diff
    .split('\n')
    .map(line => {
      if (line.startsWith('+++') || line.startsWith('---')) return chalk.bold(line);
      if (line.startsWith('+')) return chalk.green(line);
      if (line.startsWith('-')) return chalk.red(line);
      if (line.startsWith('@@')) return chalk.cyan(line);
      return chalk.gray(line);
    })
    .join('\n');
}

export function printBanner(): void {
  const banner = chalk.cyan(`
 █████╗ ██╗ ██████╗██╗     ██╗
██╔══██╗██║██╔════╝██║     ██║
███████║██║██║     ██║     ██║
██╔══██║██║██║     ██║     ██║
██║  ██║██║╚██████╗███████╗██║
╚═╝  ╚═╝╚═╝ ╚═════╝╚══════╝╚═╝`);

  console.log(banner);
  console.log(chalk.gray('  AI Coding CLI — Type /help for commands\n'));
}

export function printDivider(label?: string): void {
  const width = process.stdout.columns || 80;
  if (label) {
    const side = Math.floor((width - label.length - 4) / 2);
    const line = '─'.repeat(Math.max(1, side));
    console.log(chalk.gray(`${line} ${chalk.bold(label)} ${line}`));
  } else {
    console.log(chalk.gray('─'.repeat(width)));
  }
}

export function printSuccess(msg: string): void {
  console.log(`${SYMBOLS.success} ${COLORS.success(msg)}`);
}

export function printError(msg: string): void {
  console.error(`${SYMBOLS.error} ${COLORS.error(msg)}`);
}

export function printWarning(msg: string): void {
  console.log(`${SYMBOLS.warning} ${COLORS.warning(msg)}`);
}

export function printInfo(msg: string): void {
  console.log(`${SYMBOLS.info} ${COLORS.primary(msg)}`);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function formatTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, i) =>
    Math.max(...allRows.map(r => (r[i] || '').length))
  );
  const sep = widths.map(w => '─'.repeat(w + 2)).join('┼');
  const fmt = (row: string[]) =>
    '│ ' + row.map((cell, i) => (cell || '').padEnd(widths[i])).join(' │ ') + ' │';

  return [
    '┌─' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '─┐',
    fmt(headers).replace(/│/g, chalk.gray('│')),
    '├─' + sep + '─┤',
    ...rows.map(r => fmt(r)),
    '└─' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '─┘',
  ].map(line => chalk.gray(line)).join('\n');
}
