import fs from 'fs-extra';
import path from 'path';
import * as Diff from 'diff';
import { renderDiff } from '../utils/terminal';
import { logger } from '../utils/logger';

export interface FileOperation {
  type: 'create' | 'edit' | 'delete' | 'rename';
  path: string;
  newPath?: string;
  content?: string;
  originalContent?: string;
}

export class FileTools {
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    return path.resolve(this.workingDir, filePath);
  }

  readFile(filePath: string): string {
    const resolved = this.resolvePath(filePath);
    if (!fs.existsSync(resolved)) throw new Error(`File not found: ${filePath}`);
    return fs.readFileSync(resolved, 'utf-8');
  }

  writeFile(filePath: string, content: string): void {
    const resolved = this.resolvePath(filePath);
    fs.ensureDirSync(path.dirname(resolved));
    fs.writeFileSync(resolved, content, 'utf-8');
    logger.info('File written', { path: filePath });
  }

  deleteFile(filePath: string): void {
    const resolved = this.resolvePath(filePath);
    fs.removeSync(resolved);
    logger.info('File deleted', { path: filePath });
  }

  renameFile(oldPath: string, newPath: string): void {
    const resolvedOld = this.resolvePath(oldPath);
    const resolvedNew = this.resolvePath(newPath);
    fs.ensureDirSync(path.dirname(resolvedNew));
    fs.moveSync(resolvedOld, resolvedNew);
    logger.info('File renamed', { from: oldPath, to: newPath });
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(this.resolvePath(filePath));
  }

  generateDiff(filePath: string, newContent: string): string {
    let originalContent = '';
    const resolved = this.resolvePath(filePath);
    if (fs.existsSync(resolved)) {
      originalContent = fs.readFileSync(resolved, 'utf-8');
    }

    const diffResult = Diff.createPatch(
      filePath,
      originalContent,
      newContent,
      'original',
      'modified'
    );

    return renderDiff(diffResult);
  }

  applyOperation(op: FileOperation): void {
    switch (op.type) {
      case 'create':
      case 'edit':
        if (!op.content) throw new Error('Content required for create/edit operation');
        this.writeFile(op.path, op.content);
        break;
      case 'delete':
        this.deleteFile(op.path);
        break;
      case 'rename':
        if (!op.newPath) throw new Error('newPath required for rename operation');
        this.renameFile(op.path, op.newPath);
        break;
    }
  }

  listFiles(dir = '.', maxDepth = 3): string[] {
    const resolved = this.resolvePath(dir);
    const results: string[] = [];

    const scan = (dirPath: string, depth: number): void => {
      if (depth > maxDepth) return;
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const fullPath = path.join(dirPath, entry.name);
          const relative = path.relative(resolved, fullPath);
          if (entry.isDirectory()) {
            results.push(relative + '/');
            scan(fullPath, depth + 1);
          } else {
            results.push(relative);
          }
        }
      } catch { /* skip permission errors */ }
    };

    scan(resolved, 0);
    return results;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = path.resolve(dir);
  }

  getWorkingDir(): string {
    return this.workingDir;
  }
}

export const fileTools = new FileTools();
