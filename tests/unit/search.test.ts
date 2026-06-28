import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-search-test-' + Date.now());

describe('searchFiles', () => {
  beforeAll(() => {
    fs.ensureDirSync(path.join(TEMP_DIR, 'src'));
    fs.writeFileSync(
      path.join(TEMP_DIR, 'src', 'alpha.ts'),
      'const hello = "world";\nconst foo = 42;\n// TODO: refactor this'
    );
    fs.writeFileSync(
      path.join(TEMP_DIR, 'src', 'beta.ts'),
      'function greet(name: string) {\n  return `Hello, ${name}`;\n}'
    );
    fs.writeFileSync(
      path.join(TEMP_DIR, 'README.md'),
      '# Project\n\nThis is a hello world project.'
    );
  });

  afterAll(() => fs.removeSync(TEMP_DIR));

  it('should find literal string matches', async () => {
    const { searchFiles } = require('../../src/tools/search');
    const matches = await searchFiles(TEMP_DIR, 'hello');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m: any) => m.text.toLowerCase().includes('hello'))).toBe(true);
  });

  it('should find matches with context lines', async () => {
    const { searchFiles } = require('../../src/tools/search');
    const matches = await searchFiles(TEMP_DIR, 'TODO', { contextLines: 1 });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].context.length).toBeGreaterThan(1);
  });

  it('should support regex patterns', async () => {
    const { searchFiles } = require('../../src/tools/search');
    const matches = await searchFiles(TEMP_DIR, 'const \\w+ = ', { regex: true });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should be case-insensitive by default', async () => {
    const { searchFiles } = require('../../src/tools/search');
    const lower = await searchFiles(TEMP_DIR, 'hello');
    const upper = await searchFiles(TEMP_DIR, 'HELLO');
    expect(lower.length).toBe(upper.length);
  });

  it('should respect case-sensitive flag', async () => {
    const { searchFiles } = require('../../src/tools/search');
    const sensitive = await searchFiles(TEMP_DIR, 'HELLO', { caseSensitive: true });
    const insensitive = await searchFiles(TEMP_DIR, 'HELLO', { caseSensitive: false });
    expect(sensitive.length).toBeLessThan(insensitive.length);
  });

  it('should filter by extension', async () => {
    const { searchFiles } = require('../../src/tools/search');
    const tsOnly = await searchFiles(TEMP_DIR, 'hello', { includeExtensions: ['ts'] });
    const hasMd = tsOnly.some((m: any) => m.file.endsWith('.md'));
    expect(hasMd).toBe(false);
  });

  it('should return empty array when no matches', async () => {
    const { searchFiles } = require('../../src/tools/search');
    const matches = await searchFiles(TEMP_DIR, 'zzz_no_match_xyz');
    expect(matches).toHaveLength(0);
  });
});

describe('findFiles', () => {
  beforeAll(() => {
    fs.ensureDirSync(path.join(TEMP_DIR, 'components'));
    fs.writeFileSync(path.join(TEMP_DIR, 'components', 'Button.tsx'), '');
    fs.writeFileSync(path.join(TEMP_DIR, 'components', 'Input.tsx'), '');
  });

  it('should find files by name pattern', async () => {
    const { findFiles } = require('../../src/tools/search');
    const files = await findFiles(TEMP_DIR, 'Button');
    expect(files.some((f: string) => f.includes('Button'))).toBe(true);
  });
});
