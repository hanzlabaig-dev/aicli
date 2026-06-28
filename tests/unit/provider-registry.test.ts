import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-prov-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('ProviderRegistry', () => {
  beforeAll(() => {
    fs.ensureDirSync(TEMP_DIR);
    process.env['HOME'] = TEMP_DIR;
    jest.resetModules();
  });

  afterAll(() => {
    fs.removeSync(TEMP_DIR);
  });

  it('should return all providers', () => {
    const { providerRegistry } = require('../../src/providers/registry');
    const providers = providerRegistry.list();
    expect(providers.length).toBe(5);
    const names = providers.map((p: any) => p.name);
    expect(names).toContain('openrouter');
    expect(names).toContain('anthropic');
    expect(names).toContain('openai');
    expect(names).toContain('gemini');
    expect(names).toContain('ollama');
  });

  it('should retrieve a specific provider', () => {
    const { providerRegistry } = require('../../src/providers/registry');
    const provider = providerRegistry.get('anthropic');
    expect(provider.name).toBe('anthropic');
    expect(provider.displayName).toBe('Anthropic');
  });

  it('should throw for unknown provider', () => {
    const { providerRegistry } = require('../../src/providers/registry');
    expect(() => providerRegistry.get('unknown' as any)).toThrow('Unknown provider');
  });

  it('should report ollama as always configured', () => {
    const { providerRegistry } = require('../../src/providers/registry');
    const ollama = providerRegistry.get('ollama');
    expect(ollama.isConfigured()).toBe(true);
  });

  it('should report unconfigured providers', () => {
    const { providerRegistry } = require('../../src/providers/registry');
    delete process.env.ANTHROPIC_API_KEY;
    const anthropic = providerRegistry.get('anthropic');
    expect(anthropic.isConfigured()).toBe(false);
  });
});
