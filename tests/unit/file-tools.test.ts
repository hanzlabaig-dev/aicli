import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-file-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('FileTools', () => {
  beforeAll(() => {
    fs.ensureDirSync(TEMP_DIR);
  });

  afterAll(() => {
    fs.removeSync(TEMP_DIR);
  });

  let fileTools: any;

  beforeEach(() => {
    jest.resetModules();
    const module = require('../../src/tools/file');
    fileTools = new module.FileTools(TEMP_DIR);
  });

  it('should write and read a file', () => {
    fileTools.writeFile('test.txt', 'Hello World');
    const content = fileTools.readFile('test.txt');
    expect(content).toBe('Hello World');
  });

  it('should check file existence', () => {
    fileTools.writeFile('exists.txt', 'yes');
    expect(fileTools.fileExists('exists.txt')).toBe(true);
    expect(fileTools.fileExists('notexists.txt')).toBe(false);
  });

  it('should delete a file', () => {
    fileTools.writeFile('todelete.txt', 'bye');
    fileTools.deleteFile('todelete.txt');
    expect(fileTools.fileExists('todelete.txt')).toBe(false);
  });

  it('should rename a file', () => {
    fileTools.writeFile('original.txt', 'content');
    fileTools.renameFile('original.txt', 'renamed.txt');
    expect(fileTools.fileExists('original.txt')).toBe(false);
    expect(fileTools.fileExists('renamed.txt')).toBe(true);
    expect(fileTools.readFile('renamed.txt')).toBe('content');
  });

  it('should generate a diff', () => {
    fileTools.writeFile('diff-test.txt', 'line 1\nline 2\n');
    const diff = fileTools.generateDiff('diff-test.txt', 'line 1\nline 2 modified\n');
    expect(diff).toContain('line 2');
  });

  it('should list files in directory', () => {
    fileTools.writeFile('dir/a.ts', 'a');
    fileTools.writeFile('dir/b.ts', 'b');
    const files = fileTools.listFiles('dir');
    expect(files).toContain('a.ts');
    expect(files).toContain('b.ts');
  });

  it('should throw on reading nonexistent file', () => {
    expect(() => fileTools.readFile('nonexistent.xyz')).toThrow();
  });
});
