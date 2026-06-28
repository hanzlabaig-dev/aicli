import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  context: string[];
}

export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  includeExtensions?: string[];
  excludePatterns?: string[];
  maxResults?: number;
  contextLines?: number;
}

const DEFAULT_EXCLUDE = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage'];

/**
 * Fast text search across files using Node.js streams.
 * Supports literal string and regex patterns with context lines.
 */
export async function searchFiles(
  rootPath: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchMatch[]> {
  const {
    caseSensitive = false,
    regex = false,
    includeExtensions,
    excludePatterns = DEFAULT_EXCLUDE,
    maxResults = 100,
    contextLines = 2,
  } = options;

  const flags = caseSensitive ? 'g' : 'gi';
  let pattern: RegExp;
  try {
    pattern = new RegExp(regex ? query : escapeRegex(query), flags);
  } catch {
    throw new Error(`Invalid search pattern: ${query}`);
  }

  const ignoreGlobs = excludePatterns.map((p) => `**/${p}/**`);
  const extGlob = includeExtensions ? `**/*.{${includeExtensions.join(',')}}` : '**/*';

  const files = await glob(extGlob, {
    cwd: rootPath,
    ignore: ignoreGlobs,
    nodir: true,
    absolute: true,
  });

  const matches: SearchMatch[] = [];

  for (const filePath of files) {
    if (matches.length >= maxResults) break;

    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 2 * 1024 * 1024) continue; // skip files > 2MB

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relative = path.relative(rootPath, filePath);

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxResults) break;

        const line = lines[i];
        let match: RegExpExecArray | null;
        pattern.lastIndex = 0;

        if ((match = pattern.exec(line)) !== null) {
          const contextStart = Math.max(0, i - contextLines);
          const contextEnd = Math.min(lines.length - 1, i + contextLines);
          const context = lines.slice(contextStart, contextEnd + 1).map(
            (l, idx) => `${contextStart + idx + 1}: ${l}`
          );

          matches.push({
            file: relative,
            line: i + 1,
            column: match.index + 1,
            text: line.trim(),
            context,
          });
        }
      }
    } catch {
      // binary file or permission error — skip
    }
  }

  return matches;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find files by name pattern (like `find -name`).
 */
export async function findFiles(rootPath: string, pattern: string): Promise<string[]> {
  const ignore = DEFAULT_EXCLUDE.map((p) => `**/${p}/**`);
  const files = await glob(`**/*${pattern}*`, {
    cwd: rootPath,
    ignore,
    nodir: true,
  });
  return files.sort();
}
