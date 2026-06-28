import { spawn } from 'child_process';
import { logger } from '../utils/logger';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const BLOCKED_COMMANDS = [
  'rm -rf /',
  'mkfs',
  'dd if=',
  'chmod 777 /',
  ':(){ :|:& };:',  // fork bomb
];

/**
 * Execute a shell command with a timeout. Returns stdout/stderr/exitCode.
 * Blocks known destructive patterns.
 */
export async function execCommand(
  command: string,
  cwd: string,
  timeoutMs = 30_000
): Promise<ExecResult> {
  // Safety check
  const lower = command.toLowerCase();
  for (const blocked of BLOCKED_COMMANDS) {
    if (lower.includes(blocked)) {
      throw new Error(`Command blocked for safety: ${command}`);
    }
  }

  logger.info('Executing command', { command, cwd });

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : '/bin/sh';
    const shellFlag = isWindows ? '/c' : '-c';

    const proc = spawn(shell, [shellFlag, command], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 2000);
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.slice(0, 50_000), // cap output
        stderr: stderr.slice(0, 10_000),
        exitCode: code ?? 1,
        timedOut,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: err.message, exitCode: 1, timedOut: false });
    });
  });
}
