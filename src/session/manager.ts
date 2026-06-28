import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Session, Message, ProviderName } from '../config/types';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

class SessionManager {
  private sessionsDir: string;
  private currentSession: Session | null = null;

  constructor() {
    this.sessionsDir = path.join(configManager.getConfigDir(), 'sessions');
    fs.ensureDirSync(this.sessionsDir);
  }

  createSession(name?: string, projectPath?: string): Session {
    const cfg = configManager.get();
    const session: Session = {
      id: uuidv4(),
      name: name || `Session ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provider: cfg.activeProvider,
      model: cfg.providers[cfg.activeProvider].defaultModel || '',
      messages: [],
      projectPath,
    };
    this.currentSession = session;
    this.save(session);
    return session;
  }

  getOrCreate(projectPath?: string): Session {
    if (this.currentSession) return this.currentSession;
    return this.createSession(undefined, projectPath);
  }

  getCurrent(): Session | null {
    return this.currentSession;
  }

  addMessage(role: 'user' | 'assistant' | 'system', content: string): Message {
    if (!this.currentSession) this.createSession();
    const message: Message = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
    };
    this.currentSession!.messages.push(message);
    this.currentSession!.updatedAt = Date.now();
    this.save(this.currentSession!);
    return message;
  }

  getMessages(): Message[] {
    return this.currentSession?.messages || [];
  }

  clearMessages(): void {
    if (this.currentSession) {
      this.currentSession.messages = [];
      this.currentSession.updatedAt = Date.now();
      this.save(this.currentSession);
    }
  }

  listSessions(): Session[] {
    try {
      const files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
      return files
        .map((f) => {
          try {
            return JSON.parse(fs.readFileSync(path.join(this.sessionsDir, f), 'utf-8')) as Session;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Session[];
    } catch {
      return [];
    }
  }

  loadSession(id: string): Session | null {
    try {
      const file = path.join(this.sessionsDir, `${id}.json`);
      if (!fs.existsSync(file)) return null;
      const session = JSON.parse(fs.readFileSync(file, 'utf-8')) as Session;
      this.currentSession = session;
      return session;
    } catch (err) {
      logger.error('Failed to load session', { id, err });
      return null;
    }
  }

  deleteSession(id: string): boolean {
    try {
      const file = path.join(this.sessionsDir, `${id}.json`);
      if (fs.existsSync(file)) {
        fs.removeSync(file);
        if (this.currentSession?.id === id) this.currentSession = null;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private save(session: Session): void {
    try {
      const file = path.join(this.sessionsDir, `${session.id}.json`);
      fs.writeFileSync(file, JSON.stringify(session, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to save session', { err });
    }
  }

  updateProvider(provider: ProviderName, model: string): void {
    if (this.currentSession) {
      this.currentSession.provider = provider;
      this.currentSession.model = model;
      this.save(this.currentSession);
    }
  }

  exportSession(id: string): string | null {
    const session = this.loadSession(id) || this.currentSession;
    if (!session) return null;
    const lines = session.messages.map(
      (m) => `**[${m.role.toUpperCase()}]** (${new Date(m.timestamp).toLocaleString()})\n\n${m.content}\n`
    );
    return `# Session: ${session.name}\n\nProvider: ${session.provider} | Model: ${session.model}\n\n---\n\n${lines.join('\n---\n\n')}`;
  }
}

export const sessionManager = new SessionManager();
