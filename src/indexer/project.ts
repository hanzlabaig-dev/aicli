import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { ProjectContext } from '../config/types';
import { logger } from '../utils/logger';

const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.cache', 'coverage', '.venv', 'vendor'];
const IGNORED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.zip', '.lock'];

const LANG_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java', '.cs': 'C#',
  '.cpp': 'C++', '.c': 'C', '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift',
  '.kt': 'Kotlin', '.vue': 'Vue', '.svelte': 'Svelte',
};

const FRAMEWORK_SIGNALS: Array<{ file: string; framework: string }> = [
  { file: 'next.config', framework: 'Next.js' },
  { file: 'nuxt.config', framework: 'Nuxt' },
  { file: 'angular.json', framework: 'Angular' },
  { file: 'svelte.config', framework: 'SvelteKit' },
  { file: 'vite.config', framework: 'Vite' },
  { file: 'gatsby-config', framework: 'Gatsby' },
  { file: 'manage.py', framework: 'Django' },
  { file: 'app.py', framework: 'Flask/FastAPI' },
  { file: 'Cargo.toml', framework: 'Rust' },
  { file: 'go.mod', framework: 'Go' },
  { file: 'pom.xml', framework: 'Maven/Spring' },
];

export interface FileEntry {
  path: string;
  relativePath: string;
  extension: string;
  language?: string;
  size: number;
  content?: string;
}

export interface ProjectIndex {
  context: ProjectContext;
  files: FileEntry[];
  indexedAt: number;
  searchIndex: Map<string, string[]>;
}

class ProjectIndexer {
  private projectIndex: ProjectIndex | null = null;
  private projectPath: string | null = null;

  async index(projectPath: string, includeContent = false): Promise<ProjectIndex> {
    this.projectPath = path.resolve(projectPath);
    logger.info('Indexing project', { path: this.projectPath });

    const files = await this.scanFiles(this.projectPath, includeContent);
    const context = await this.analyzeContext(this.projectPath, files);
    const searchIndex = this.buildSearchIndex(files);

    this.projectIndex = { context, files, indexedAt: Date.now(), searchIndex };
    return this.projectIndex;
  }

  private async scanFiles(projectPath: string, includeContent: boolean): Promise<FileEntry[]> {
    const ignorePattern = IGNORED_DIRS.map((d) => `**/${d}/**`);
    const filePaths = await glob('**/*', { cwd: projectPath, ignore: ignorePattern, nodir: true, absolute: true });
    const entries: FileEntry[] = [];

    for (const filePath of filePaths.slice(0, 5000)) {
      const ext = path.extname(filePath).toLowerCase();
      if (IGNORED_EXTS.includes(ext)) continue;
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > 1024 * 1024) continue;
        const entry: FileEntry = {
          path: filePath,
          relativePath: path.relative(projectPath, filePath),
          extension: ext,
          language: LANG_MAP[ext],
          size: stat.size,
        };
        if (includeContent && stat.size < 100 * 1024) {
          try { entry.content = fs.readFileSync(filePath, 'utf-8'); } catch { /* binary */ }
        }
        entries.push(entry);
      } catch { /* skip */ }
    }
    return entries;
  }

  private async analyzeContext(projectPath: string, files: FileEntry[]): Promise<ProjectContext> {
    const languages = [...new Set(files.map((f) => f.language).filter(Boolean))] as string[];
    const filenames = files.map((f) => path.basename(f.path));

    let framework: string | undefined;
    for (const signal of FRAMEWORK_SIGNALS) {
      if (filenames.some((f) => f.startsWith(signal.file) || f === signal.file)) {
        framework = signal.framework;
        break;
      }
    }

    let packageManager: string | undefined;
    if (filenames.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
    else if (filenames.includes('yarn.lock')) packageManager = 'yarn';
    else if (filenames.includes('package-lock.json')) packageManager = 'npm';
    else if (filenames.includes('Pipfile.lock')) packageManager = 'pipenv';
    else if (filenames.includes('poetry.lock')) packageManager = 'poetry';
    else if (filenames.includes('Cargo.lock')) packageManager = 'cargo';

    const structure: Record<string, unknown> = {};
    const topDirs = new Set<string>();
    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      if (parts.length > 1) topDirs.add(parts[0]);
    }
    topDirs.forEach((d) => (structure[d] = {}));

    return { path: projectPath, language: languages, framework, packageManager, files: files.map((f) => f.relativePath), structure };
  }

  private buildSearchIndex(files: FileEntry[]): Map<string, string[]> {
    const idx = new Map<string, string[]>();
    for (const file of files) {
      if (!file.content) continue;
      const words = new Set(file.content.toLowerCase().split(/[\s\W]+/).filter((w) => w.length > 3));
      for (const word of words) {
        if (!idx.has(word)) idx.set(word, []);
        idx.get(word)!.push(file.relativePath);
      }
    }
    return idx;
  }

  search(query: string, maxResults = 20): FileEntry[] {
    if (!this.projectIndex) return [];
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const scores = new Map<string, number>();

    for (const word of words) {
      for (const [keyword, paths] of this.projectIndex.searchIndex) {
        if (keyword.includes(word) || word.includes(keyword)) {
          for (const p of paths) scores.set(p, (scores.get(p) || 0) + 1);
        }
      }
    }

    for (const file of this.projectIndex.files) {
      const fn = file.relativePath.toLowerCase();
      if (words.some((w) => fn.includes(w))) {
        scores.set(file.relativePath, (scores.get(file.relativePath) || 0) + 3);
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([p]) => this.projectIndex!.files.find((f) => f.relativePath === p)!)
      .filter(Boolean);
  }

  getContext(): ProjectContext | null {
    return this.projectIndex?.context || null;
  }

  getIndex(): ProjectIndex | null {
    return this.projectIndex;
  }

  readFile(relativePath: string): string | null {
    if (!this.projectPath) return null;
    const fullPath = path.join(this.projectPath, relativePath);
    try { return fs.readFileSync(fullPath, 'utf-8'); } catch { return null; }
  }

  getFileTree(maxDepth = 3): string {
    if (!this.projectIndex) return '';
    const tree: string[] = [];
    for (const file of this.projectIndex.files.slice(0, 200)) {
      const parts = file.relativePath.split(path.sep);
      if (parts.length <= maxDepth) tree.push(file.relativePath);
    }
    return tree.sort().join('\n');
  }
}

export const projectIndexer = new ProjectIndexer();
