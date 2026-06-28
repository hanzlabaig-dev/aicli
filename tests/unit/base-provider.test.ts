import { BaseProvider, ChatOptions } from '../../src/providers/base';
import { StreamChunk } from '../../src/config/types';

class MockProvider extends BaseProvider {
  readonly name = 'mock';
  readonly displayName = 'Mock';
  isConfigured() { return true; }
  async listModels() { return [{ id: 'mock-model', name: 'Mock Model' }]; }
  async chat(options: ChatOptions) { return `echo: ${options.messages[options.messages.length - 1].content}`; }
  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    yield { content: `echo: ${options.messages[options.messages.length - 1].content}`, done: false };
    yield { content: '', done: true };
  }
}

describe('BaseProvider', () => {
  const provider = new MockProvider();

  it('should build messages array from ChatOptions', () => {
    const options: ChatOptions = {
      model: 'mock-model',
      messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: 0 }],
      systemPrompt: 'You are a test assistant.',
    };
    const built = (provider as any).buildMessages(options);
    expect(built[0].role).toBe('system');
    expect(built[0].content).toBe('You are a test assistant.');
    expect(built[1].role).toBe('user');
    expect(built[1].content).toBe('Hello');
  });

  it('should omit system message when no systemPrompt', () => {
    const options: ChatOptions = {
      model: 'mock-model',
      messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: 0 }],
    };
    const built = (provider as any).buildMessages(options);
    expect(built).toHaveLength(1);
    expect(built[0].role).toBe('user');
  });

  it('should sanitize API keys from error messages', () => {
    const err = new Error('Failed with key sk-abc123XYZ and token sk-ant-something');
    const sanitized = (provider as any).sanitizeError(err);
    expect(sanitized.message).not.toContain('sk-abc123XYZ');
    expect(sanitized.message).toContain('[REDACTED]');
  });

  it('should chat and return response', async () => {
    const response = await provider.chat({
      model: 'mock-model',
      messages: [{ id: '1', role: 'user', content: 'ping', timestamp: 0 }],
    });
    expect(response).toBe('echo: ping');
  });

  it('should stream response chunks', async () => {
    const chunks: string[] = [];
    const stream = provider.chatStream({
      model: 'mock-model',
      messages: [{ id: '1', role: 'user', content: 'ping', timestamp: 0 }],
    });
    for await (const chunk of stream) {
      if (chunk.content) chunks.push(chunk.content);
    }
    expect(chunks.join('')).toBe('echo: ping');
  });
});
