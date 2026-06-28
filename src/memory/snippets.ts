import fs from 'fs-extra';
import path from 'path';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

export interface Snippet {
  id: string;
  label: string;
  content: string;
  language?: string;
  createdAt: number;
}

/**
 * SnippetStore lets users pin important pieces of code/notes that should be
 * automatically included in the system prompt, giving the AI persistent memory
 * of things like project conventions, key types, or reference implementations.
 */
class SnippetStore {
  private filePath: string;
  private snippets: Snippet[] = [];

  constructor() {
    this.filePath = path.join(configManager.getConfigDir(), 'snippets.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        this.snippets = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Snippet[];
      }
    } catch (err) {
      logger.error('Failed to load snippets', { err });
      this.snippets = [];
    }
  }

  private save(): void {
    try {
      fs.ensureDirSync(path.dirname(this.filePath));
      fs.writeFileSync(this.filePath, JSON.stringify(this.snippets, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to save snippets', { err });
    }
  }

  add(label: string, content: string, language?: string): Snippet {
    const snippet: Snippet = {
      id: `snip_${Date.now()}`,
      label,
      content,
      language,
      createdAt: Date.now(),
    };
    this.snippets.push(snippet);
    this.save();
    return snippet;
  }

  remove(id: string): boolean {
    const before = this.snippets.length;
    this.snippets = this.snippets.filter((s) => s.id !== id);
    if (this.snippets.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  list(): Snippet[] {
    return [...this.snippets];
  }

  get(id: string): Snippet | undefined {
    return this.snippets.find((s) => s.id === id);
  }

  clear(): void {
    this.snippets = [];
    this.save();
  }

  /**
   * Render pinned snippets as a block that can be appended to the system prompt.
   */
  renderForSystemPrompt(): string {
    if (this.snippets.length === 0) return '';
    const blocks = this.snippets.map(
      (s) =>
        `### ${s.label}\n${s.language ? `\`\`\`${s.language}\n` : ''}${s.content}${s.language ? '\n```' : ''}`
    );
    return `\n\n## Pinned Context\n\n${blocks.join('\n\n')}`;
  }
}

export const snippetStore = new SnippetStore();
