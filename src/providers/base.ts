import { Message, StreamChunk } from '../config/types';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  pricing?: { prompt: number; completion: number };
  tags?: string[];
}

export interface ChatOptions {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;

  abstract isConfigured(): boolean;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract chat(options: ChatOptions): Promise<string>;
  abstract chatStream(options: ChatOptions): AsyncGenerator<StreamChunk>;

  protected buildMessages(options: ChatOptions): Array<{ role: string; content: string }> {
    const msgs: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      msgs.push({ role: 'system', content: options.systemPrompt });
    }
    for (const msg of options.messages) {
      msgs.push({ role: msg.role, content: msg.content });
    }
    return msgs;
  }

  protected sanitizeError(err: unknown): Error {
    const message = err instanceof Error ? err.message : String(err);
    // Ensure no API keys leak into error messages
    return new Error(message.replace(/sk-[a-zA-Z0-9-_]+/g, '[REDACTED]'));
  }
}
