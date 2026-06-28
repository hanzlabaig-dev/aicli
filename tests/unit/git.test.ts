import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-git-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

function initRepo(dir: string) {
  fs.ensureDirSync(dir);
  execSync('git init', { cwd: dir });
  execSync('git config user.email "test@test.com"', { cwd: dir });
  execSync('git config user.name "Test"', { cwd: dir });
  execSync('git checkout -b main', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test Repo');
  execSync('git add .', { cwd: dir });
  execSync('git commit -m "initial commit"', { cwd: dir });
}

describe('GitIntegration', () => {
  beforeAll(() => {
    try {
      initRepo(TEMP_DIR);
    } catch { /* skip if git not available */ }
  });

  afterAll(() => fs.removeSync(TEMP_DIR));

  it('should detect a git repository', async () => {
    jest.resetModules();
    const { gitIntegration } = require('../../src/git/integration');
    const ok = await gitIntegration.init(TEMP_DIR);
    expect(ok).toBe(true);
  });

  it('should return false for non-repo directory', async () => {
    jest.resetModules();
    const { gitIntegration } = require('../../src/git/integration');
    const tmpNoGit = os.tmpdir();
    const ok = await gitIntegration.init(tmpNoGit);
    expect(ok).toBe(false);
  });

  it('should get status of clean repo', async () => {
    jest.resetModules();
    const { gitIntegration } = require('../../src/git/integration');
    await gitIntegration.init(TEMP_DIR);
    const status = await gitIntegration.status();
    expect(status.isClean()).toBe(true);
  });

  it('should detect modified files', async () => {
    jest.resetModules();
    const { gitIntegration } = require('../../src/git/integration');
    await gitIntegration.init(TEMP_DIR);
    fs.writeFileSync(path.join(TEMP_DIR, 'README.md'), '# Modified');
    const status = await gitIntegration.status();
    expect(status.modified.length).toBeGreaterThan(0);
    // Restore
    fs.writeFileSync(path.join(TEMP_DIR, 'README.md'), '# Test Repo');
  });

  it('should get commit log', async () => {
    jest.resetModules();
    const { gitIntegration } = require('../../src/git/integration');
    await gitIntegration.init(TEMP_DIR);
    const log = await gitIntegration.log(5);
    expect(log.all.length).toBeGreaterThan(0);
    expect(log.all[0].message).toBe('initial commit');
  });

  it('should get current branch', async () => {
    jest.resetModules();
    const { gitIntegration } = require('../../src/git/integration');
    await gitIntegration.init(TEMP_DIR);
    const branch = await gitIntegration.getCurrentBranch();
    expect(branch).toBe('main');
  });

  it('should generate a commit message from diff', async () => {
    jest.resetModules();
    const { gitIntegration } = require('../../src/git/integration');
    await gitIntegration.init(TEMP_DIR);
    const diff = '+++ b/src/auth.ts\n--- a/src/auth.ts\n+export function login() {}\n-export function logout() {}';
    const msg = await gitIntegration.generateCommitMessage(diff);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
