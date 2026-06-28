import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock the config dir to use a temp directory for tests
const TEMP_DIR = path.join(os.tmpdir(), 'aicli-test-' + Date.now());
jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('ConfigManager', () => {
  beforeAll(() => {
    fs.ensureDirSync(TEMP_DIR);
    process.env['HOME'] = TEMP_DIR;
  });

  afterAll(() => {
    fs.removeSync(TEMP_DIR);
  });

  it('should have default configuration', () => {
    // Re-require after setting HOME
    jest.resetModules();
    const { configManager } = require('../../src/config/manager');
    const cfg = configManager.get();
    expect(cfg.version).toBe('1.0.0');
    expect(cfg.activeProvider).toBe('openrouter');
    expect(cfg.streamingEnabled).toBe(true);
    expect(cfg.providers.openrouter).toBeDefined();
    expect(cfg.providers.anthropic).toBeDefined();
  });

  it('should set and get active provider', () => {
    jest.resetModules();
    const { configManager } = require('../../src/config/manager');
    configManager.setActiveProvider('anthropic');
    expect(configManager.get().activeProvider).toBe('anthropic');
    configManager.setActiveProvider('openrouter'); // reset
  });

  it('should set default model for a provider', () => {
    jest.resetModules();
    const { configManager } = require('../../src/config/manager');
    configManager.setDefaultModel('openai', 'gpt-4o');
    expect(configManager.get().providers.openai.defaultModel).toBe('gpt-4o');
  });

  it('should prefer environment variable for API key', () => {
    jest.resetModules();
    process.env.OPENAI_API_KEY = 'env-test-key';
    const { configManager } = require('../../src/config/manager');
    expect(configManager.getApiKey('openai')).toBe('env-test-key');
    delete process.env.OPENAI_API_KEY;
  });

  it('should set github config', () => {
    jest.resetModules();
    const { configManager } = require('../../src/config/manager');
    configManager.set('github', { token: 'ghp_test' });
    expect(configManager.get().github.token).toBe('ghp_test');
  });
});
