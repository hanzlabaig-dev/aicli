import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-cmd-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
// Mock enquirer to auto-confirm
jest.mock('enquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ confirmed: false }),
}));

function makeState(overrides = {}) {
  return {
    currentModel: 'gpt-4o-mini',
    currentProvider: 'openrouter' as const,
    projectPath: TEMP_DIR,
    isIndexed: false,
    isStreaming: false,
    theme: 'dark',
    exitRequested: false,
    ...overrides,
  };
}

describe('Command Registry', () => {
  beforeAll(() => {
    fs.ensureDirSync(TEMP_DIR);
    process.env['HOME'] = TEMP_DIR;
    jest.resetModules();
  });

  afterAll(() => fs.removeSync(TEMP_DIR));

  it('should register and find commands', () => {
    const { commandRegistry } = require('../../src/commands/registry');
    const { registerCommands } = require('../../src/commands/index');
    registerCommands();
    expect(commandRegistry.find('help')).toBeDefined();
    expect(commandRegistry.find('exit')).toBeDefined();
    expect(commandRegistry.find('git')).toBeDefined();
  });

  it('should find commands by alias', () => {
    const { commandRegistry } = require('../../src/commands/registry');
    expect(commandRegistry.find('h')).toBeDefined();
    expect(commandRegistry.find('q')).toBeDefined();
  });

  it('should return undefined for unknown command', () => {
    const { commandRegistry } = require('../../src/commands/registry');
    expect(commandRegistry.find('doesnotexist')).toBeUndefined();
  });
});

describe('VersionCommand', () => {
  it('should return handled:true', async () => {
    jest.resetModules();
    const { VersionCommand } = require('../../src/commands/implementations');
    const cmd = new VersionCommand();
    const result = await cmd.execute([], makeState());
    expect(result.handled).toBe(true);
  });
});

describe('ClearCommand', () => {
  it('should clear messages and return handled', async () => {
    process.env['HOME'] = TEMP_DIR;
    jest.resetModules();
    const { ClearCommand } = require('../../src/commands/implementations');
    const { sessionManager } = require('../../src/session/manager');
    sessionManager.createSession('test');
    sessionManager.addMessage('user', 'hello');
    const cmd = new ClearCommand();
    const result = await cmd.execute([], makeState());
    expect(result.handled).toBe(true);
    expect(sessionManager.getMessages()).toHaveLength(0);
  });
});

describe('ExitCommand', () => {
  it('should set exitRequested and return exit:true', async () => {
    jest.resetModules();
    const { ExitCommand } = require('../../src/commands/implementations');
    const state = makeState();
    const cmd = new ExitCommand();
    const result = await cmd.execute([], state);
    expect(result.handled).toBe(true);
    expect(result.exit).toBe(true);
    expect(state.exitRequested).toBe(true);
  });
});

describe('SearchCommand (project search)', () => {
  it('should warn when not indexed', async () => {
    process.env['HOME'] = TEMP_DIR;
    jest.resetModules();
    // Ensure TEMP_DIR exists and has a file to index
    fs.ensureDirSync(TEMP_DIR);
    fs.writeFileSync(path.join(TEMP_DIR, 'index.ts'), 'const auth = () => {}');
    const { SearchCommand } = require('../../src/commands/implementations');
    const cmd = new SearchCommand();
    const state = makeState({ isIndexed: false });
    // Should not throw even when not indexed (it auto-indexes)
    const result = await cmd.execute(['auth'], state);
    expect(result.handled).toBe(true);
  });
});
