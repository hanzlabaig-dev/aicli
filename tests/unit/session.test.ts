import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const TEMP_DIR = path.join(os.tmpdir(), 'aicli-session-test-' + Date.now());

jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('SessionManager', () => {
  beforeAll(() => {
    fs.ensureDirSync(TEMP_DIR);
    process.env['HOME'] = TEMP_DIR;
    jest.resetModules();
  });

  afterAll(() => {
    fs.removeSync(TEMP_DIR);
  });

  it('should create a new session', () => {
    const { sessionManager } = require('../../src/session/manager');
    const session = sessionManager.createSession('Test Session');
    expect(session.name).toBe('Test Session');
    expect(session.messages).toHaveLength(0);
    expect(session.id).toBeDefined();
  });

  it('should add messages to session', () => {
    const { sessionManager } = require('../../src/session/manager');
    sessionManager.createSession('Message Test');
    sessionManager.addMessage('user', 'Hello AI');
    sessionManager.addMessage('assistant', 'Hello User');
    const messages = sessionManager.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello AI');
  });

  it('should clear messages', () => {
    const { sessionManager } = require('../../src/session/manager');
    sessionManager.createSession('Clear Test');
    sessionManager.addMessage('user', 'test');
    sessionManager.clearMessages();
    expect(sessionManager.getMessages()).toHaveLength(0);
  });

  it('should list sessions', () => {
    const { sessionManager } = require('../../src/session/manager');
    sessionManager.createSession('List Test 1');
    sessionManager.createSession('List Test 2');
    const sessions = sessionManager.listSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('should export session as markdown', () => {
    const { sessionManager } = require('../../src/session/manager');
    const session = sessionManager.createSession('Export Test');
    sessionManager.addMessage('user', 'Question');
    sessionManager.addMessage('assistant', 'Answer');
    const md = sessionManager.exportSession(session.id);
    expect(md).toContain('Export Test');
    expect(md).toContain('Question');
    expect(md).toContain('Answer');
  });
});
