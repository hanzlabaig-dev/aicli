/**
 * Integration tests that exercise multiple layers together without making
 * real network calls to AI providers.
 */
import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-int-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

// Mock the provider so we don't need real API keys
jest.mock('../../src/providers/registry', () => {
  const mockProvider = {
    name: 'mock',
    displayName: 'Mock',
    isConfigured: () => true,
    chat: jest.fn().mockResolvedValue('This is a test response from the AI.'),
    chatStream: jest.fn(async function* () {
      yield { content: 'Test ', done: false };
      yield { content: 'response.', done: false };
      yield { content: '', done: true };
    }),
    listModels: jest.fn().mockResolvedValue([
      { id: 'mock-model', name: 'Mock Model', tags: ['coding'] },
    ]),
  };

  return {
    providerRegistry: {
      getActive: () => mockProvider,
      getActiveModel: () => 'mock-model',
      get: () => mockProvider,
      list: () => [{ name: 'mock', provider: mockProvider, configured: true }],
      all: () => [mockProvider],
    },
  };
});

describe('Full CLI Integration', () => {
  beforeAll(() => {
    fs.ensureDirSync(path.join(TEMP_DIR, 'src'));
    fs.writeFileSync(path.join(TEMP_DIR, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }));
    fs.writeFileSync(path.join(TEMP_DIR, 'src', 'index.ts'), 'export const main = () => console.log("hello");');
    fs.writeFileSync(path.join(TEMP_DIR, 'src', 'auth.ts'), 'export function login(user: string) {}');
    process.env['HOME'] = TEMP_DIR;
    jest.resetModules();
  });

  afterAll(() => fs.removeSync(TEMP_DIR));

  it('should index project and find files', async () => {
    const { projectIndexer } = require('../../src/indexer/project');
    const idx = await projectIndexer.index(TEMP_DIR, true);
    expect(idx.files.length).toBeGreaterThan(0);
    expect(idx.context.language).toContain('TypeScript');
  });

  it('should search indexed project', async () => {
    const { projectIndexer } = require('../../src/indexer/project');
    await projectIndexer.index(TEMP_DIR, true);
    const results = projectIndexer.search('login');
    expect(results.some((r: any) => r.relativePath.includes('auth'))).toBe(true);
  });

  it('should write and read files through FileTools', () => {
    const { FileTools } = require('../../src/tools/file');
    const tools = new FileTools(TEMP_DIR);
    tools.writeFile('src/utils.ts', 'export const noop = () => {};');
    expect(tools.readFile('src/utils.ts')).toContain('noop');
    tools.deleteFile('src/utils.ts');
  });

  it('should parse and detect no tool calls in plain text', () => {
    const { parseToolCalls } = require('../../src/cli/ai-agent');
    const text = 'Here is a plain text response with no tool calls.';
    expect(parseToolCalls(text)).toHaveLength(0);
  });

  it('should parse tool calls correctly', () => {
    const { parseToolCalls } = require('../../src/cli/ai-agent');
    const text = 'Let me read that file.\n```tool\n{"tool":"read_file","path":"src/index.ts"}\n```';
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe('read_file');
  });

  it('should build system prompt with indexed context', async () => {
    const { projectIndexer } = require('../../src/indexer/project');
    const { buildSystemPrompt } = require('../../src/cli/ai-agent');
    await projectIndexer.index(TEMP_DIR, true);
    const state = {
      projectPath: TEMP_DIR,
      currentProvider: 'mock' as any,
      currentModel: 'mock-model',
      isIndexed: true,
      isStreaming: false,
      theme: 'dark',
      exitRequested: false,
    };
    const prompt = buildSystemPrompt(state);
    expect(prompt).toContain('AICLI');
    expect(prompt).toContain(TEMP_DIR);
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('read_file');
  });

  it('should manage session messages end-to-end', () => {
    const { sessionManager } = require('../../src/session/manager');
    const session = sessionManager.createSession('Integration Test', TEMP_DIR);
    expect(session.id).toBeDefined();

    sessionManager.addMessage('user', 'What does auth.ts do?');
    sessionManager.addMessage('assistant', 'It handles login.');
    const messages = sessionManager.getMessages();
    expect(messages).toHaveLength(2);

    const md = sessionManager.exportSession(session.id);
    expect(md).toContain('auth.ts');
    expect(md).toContain('handles login');
  });

  it('should trim context when messages exceed token budget', () => {
    const { contextManager } = require('../../src/memory/context');
    const longMessages = Array.from({ length: 50 }, (_, i) => ({
      id: `m_${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: 'x'.repeat(1000),
      timestamp: i,
    }));
    const trimmed = contextManager.trim(longMessages, 5000);
    expect(trimmed.length).toBeLessThan(longMessages.length);
  });
});
