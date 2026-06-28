import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-snip-test-' + Date.now());
jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('SnippetStore', () => {
  beforeAll(() => {
    fs.ensureDirSync(TEMP_DIR);
    process.env['HOME'] = TEMP_DIR;
    jest.resetModules();
  });

  afterAll(() => fs.removeSync(TEMP_DIR));

  it('should add and list snippets', () => {
    const { snippetStore } = require('../../src/memory/snippets');
    snippetStore.clear();
    snippetStore.add('Auth type', 'type User = { id: string }', 'typescript');
    const list = snippetStore.list();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Auth type');
    expect(list[0].language).toBe('typescript');
  });

  it('should remove a snippet by id', () => {
    const { snippetStore } = require('../../src/memory/snippets');
    snippetStore.clear();
    const s = snippetStore.add('Temp', 'const x = 1');
    expect(snippetStore.remove(s.id)).toBe(true);
    expect(snippetStore.list()).toHaveLength(0);
  });

  it('should return false when removing nonexistent id', () => {
    const { snippetStore } = require('../../src/memory/snippets');
    expect(snippetStore.remove('nonexistent_id')).toBe(false);
  });

  it('should render snippets for system prompt', () => {
    const { snippetStore } = require('../../src/memory/snippets');
    snippetStore.clear();
    snippetStore.add('API base URL', 'const BASE = "https://api.example.com"', 'typescript');
    const rendered = snippetStore.renderForSystemPrompt();
    expect(rendered).toContain('Pinned Context');
    expect(rendered).toContain('API base URL');
    expect(rendered).toContain('BASE');
  });

  it('should return empty string when no snippets', () => {
    const { snippetStore } = require('../../src/memory/snippets');
    snippetStore.clear();
    expect(snippetStore.renderForSystemPrompt()).toBe('');
  });
});
