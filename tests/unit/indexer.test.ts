import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-idx-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('ProjectIndexer', () => {
  beforeAll(async () => {
    fs.ensureDirSync(TEMP_DIR);
    process.env['HOME'] = TEMP_DIR;

    // Create a fake project
    fs.writeFileSync(path.join(TEMP_DIR, 'package.json'), JSON.stringify({ name: 'test-project' }));
    fs.ensureDirSync(path.join(TEMP_DIR, 'src'));
    fs.writeFileSync(path.join(TEMP_DIR, 'src', 'index.ts'), 'export const main = () => {};\n// authentication handler');
    fs.writeFileSync(path.join(TEMP_DIR, 'src', 'auth.ts'), 'export function authenticate(token: string) {}');
    fs.writeFileSync(path.join(TEMP_DIR, 'src', 'db.ts'), 'export const connectDatabase = () => {}');
    fs.ensureDirSync(path.join(TEMP_DIR, 'node_modules', 'dummy'));
    fs.writeFileSync(path.join(TEMP_DIR, 'node_modules', 'dummy', 'index.js'), 'module.exports = {}');
  });

  afterAll(() => fs.removeSync(TEMP_DIR));

  it('should index project files', async () => {
    jest.resetModules();
    const { projectIndexer } = require('../../src/indexer/project');
    const idx = await projectIndexer.index(TEMP_DIR, true);
    expect(idx.files.length).toBeGreaterThan(0);
    // Should not include node_modules
    const hasNodeModules = idx.files.some((f: any) => f.relativePath.includes('node_modules'));
    expect(hasNodeModules).toBe(false);
  });

  it('should detect TypeScript as project language', async () => {
    jest.resetModules();
    const { projectIndexer } = require('../../src/indexer/project');
    await projectIndexer.index(TEMP_DIR, true);
    const ctx = projectIndexer.getContext();
    expect(ctx.language).toContain('TypeScript');
  });

  it('should search files by keyword', async () => {
    jest.resetModules();
    const { projectIndexer } = require('../../src/indexer/project');
    await projectIndexer.index(TEMP_DIR, true);
    const results = projectIndexer.search('authentication');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].relativePath).toContain('index.ts');
  });

  it('should return file tree as string', async () => {
    jest.resetModules();
    const { projectIndexer } = require('../../src/indexer/project');
    await projectIndexer.index(TEMP_DIR, true);
    const tree = projectIndexer.getFileTree();
    expect(typeof tree).toBe('string');
    expect(tree).toContain('src');
  });

  it('should read a file by relative path', async () => {
    jest.resetModules();
    const { projectIndexer } = require('../../src/indexer/project');
    await projectIndexer.index(TEMP_DIR, true);
    const content = projectIndexer.readFile('src/auth.ts');
    expect(content).toContain('authenticate');
  });

  it('should return null for nonexistent file', async () => {
    jest.resetModules();
    const { projectIndexer } = require('../../src/indexer/project');
    await projectIndexer.index(TEMP_DIR, true);
    const content = projectIndexer.readFile('src/nonexistent.ts');
    expect(content).toBeNull();
  });
});
