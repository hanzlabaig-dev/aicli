import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ModelInfo, ChatOptions } from './base';
import { StreamChunk, Message } from '../config/types';
import { configManager } from '../config/manager';

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', contextLength: 200000, tags: ['reasoning', 'coding'] },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextLength: 200000, tags: ['coding'] },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextLength: 200000, tags: ['coding'] },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextLength: 200000, tags: ['fast'] },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextLength: 200000, tags: ['reasoning'] },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextLength: 200000, tags: ['fast'] },
];

function toAnthropicMessages(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';
  readonly displayName = 'Anthropic';

  private getClient(): Anthropic {
    const apiKey = configManager.getApiKey('anthropic');
    if (!apiKey) throw new Error('Anthropic API key not configured');
    return new Anthropic({ apiKey });
  }

  isConfigured(): boolean {
    return !!configManager.getApiKey('anthropic');
  }

  async listModels(): Promise<ModelInfo[]> {
    return ANTHROPIC_MODELS;
  }

  async chat(options: ChatOptions): Promise<string> {
    const client = this.getClient();
    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens || 4096,
      system: options.systemPrompt,
      messages: toAnthropicMessages(options.messages),
    });
    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('');
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const client = this.getClient();
    const stream = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens || 4096,
      system: options.systemPrompt,
      messages: toAnthropicMessages(options.messages),
      stream: true,
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { content: event.delta.text, done: false };
      } else if (event.type === 'message_stop') {
        yield { content: '', done: true };
      }
    }
  }
}
