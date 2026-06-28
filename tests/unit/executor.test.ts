import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-exec-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('execCommand', () => {
  beforeAll(() => fs.ensureDirSync(TEMP_DIR));
  afterAll(() => fs.removeSync(TEMP_DIR));

  it('should execute a simple echo command', async () => {
    const { execCommand } = require('../../src/tools/executor');
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'echo hello' : 'echo hello';
    const result = await execCommand(cmd, TEMP_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.timedOut).toBe(false);
  });

  it('should capture exit code from failing command', async () => {
    const { execCommand } = require('../../src/tools/executor');
    const cmd = process.platform === 'win32' ? 'exit 1' : 'exit 1';
    const result = await execCommand(cmd, TEMP_DIR);
    expect(result.exitCode).not.toBe(0);
  });

  it('should block known destructive commands', async () => {
    const { execCommand } = require('../../src/tools/executor');
    await expect(execCommand('rm -rf /', TEMP_DIR)).rejects.toThrow('blocked for safety');
  });

  it('should accept a custom timeout parameter without error', async () => {
    // We verify that execCommand accepts a timeoutMs argument and completes
    // instantly for a fast command even when a long timeout is set.
    const { execCommand } = require('../../src/tools/executor');
    const cmd = process.platform === 'win32' ? 'echo done' : 'echo done';
    const result = await execCommand(cmd, TEMP_DIR, 5000);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it('should capture stderr', async () => {
    const { execCommand } = require('../../src/tools/executor');
    const cmd = process.platform === 'win32'
      ? 'echo error 1>&2'
      : 'echo error >&2';
    const result = await execCommand(cmd, TEMP_DIR);
    expect(result.stderr).toContain('error');
  });
});
