import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';
import path from 'path';
import { logger } from '../utils/logger';

export interface BranchInfo {
  current: string;
  all: string[];
  remote: string[];
}

class GitIntegration {
  private git: SimpleGit | null = null;
  private repoPath: string | null = null;

  async init(repoPath: string): Promise<boolean> {
    try {
      this.repoPath = path.resolve(repoPath);
      this.git = simpleGit(this.repoPath);
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) { this.git = null; return false; }
      return true;
    } catch (err) {
      logger.debug('Git init failed', { err });
      this.git = null;
      return false;
    }
  }

  isInitialized(): boolean { return this.git !== null; }

  async status(): Promise<StatusResult> {
    if (!this.git) throw new Error('Git not initialized');
    return this.git.status();
  }

  async diff(cached = false): Promise<string> {
    if (!this.git) throw new Error('Git not initialized');
    return cached ? this.git.diff(['--cached']) : this.git.diff();
  }

  async log(maxCount = 20): Promise<LogResult> {
    if (!this.git) throw new Error('Git not initialized');
    return this.git.log({ maxCount });
  }

  async branches(): Promise<BranchInfo> {
    if (!this.git) throw new Error('Git not initialized');
    const result = await this.git.branch(['-a']);
    return {
      current: result.current,
      all: result.all.filter((b) => !b.includes('remotes/')),
      remote: result.all.filter((b) => b.includes('remotes/')),
    };
  }

  async checkoutBranch(branch: string, create = false): Promise<void> {
    if (!this.git) throw new Error('Git not initialized');
    if (create) await this.git.checkoutLocalBranch(branch);
    else await this.git.checkout(branch);
  }

  async commit(message: string, files?: string[]): Promise<string> {
    if (!this.git) throw new Error('Git not initialized');
    if (files && files.length > 0) await this.git.add(files);
    else await this.git.add('.');
    const result = await this.git.commit(message);
    return result.commit;
  }

  async push(remote = 'origin', branch?: string): Promise<void> {
    if (!this.git) throw new Error('Git not initialized');
    const b = branch || (await this.git.status()).current || 'main';
    await this.git.push(remote, b);
  }

  async pull(remote = 'origin'): Promise<void> {
    if (!this.git) throw new Error('Git not initialized');
    await this.git.pull(remote);
  }

  async generateCommitMessage(diff: string): Promise<string> {
    const lines = diff.split('\n');
    const added = lines.filter((l) => l.startsWith('+')).length;
    const removed = lines.filter((l) => l.startsWith('-')).length;
    const files = lines
      .filter((l) => l.startsWith('+++') || l.startsWith('---'))
      .map((l) => l.replace(/^[+-]{3}\s+[ab]\//, '').split('/').pop() || '')
      .filter(Boolean);
    const unique = [...new Set(files)];
    const fileList = unique.slice(0, 3).join(', ');
    const more = unique.length > 3 ? ` and ${unique.length - 3} more` : '';
    return `Update ${fileList}${more} (+${added} -${removed} lines)`;
  }

  async stash(): Promise<void> {
    if (!this.git) throw new Error('Git not initialized');
    await this.git.stash();
  }

  async stashPop(): Promise<void> {
    if (!this.git) throw new Error('Git not initialized');
    await this.git.stash(['pop']);
  }

  async getRemoteUrl(): Promise<string | null> {
    if (!this.git) return null;
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find((r) => r.name === 'origin');
      return origin?.refs?.fetch || null;
    } catch { return null; }
  }

  async getCurrentBranch(): Promise<string> {
    if (!this.git) throw new Error('Git not initialized');
    const status = await this.git.status();
    return status.current || 'HEAD';
  }

  async clone(url: string, targetPath: string): Promise<void> {
    const git = simpleGit();
    await git.clone(url, targetPath);
  }
}

export const gitIntegration = new GitIntegration();
