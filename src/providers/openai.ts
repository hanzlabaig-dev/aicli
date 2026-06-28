import OpenAI from 'openai';
import { BaseProvider, ModelInfo, ChatOptions } from './base';
import { StreamChunk } from '../config/types';
import { configManager } from '../config/manager';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';
  readonly displayName = 'OpenAI';

  private getClient(): OpenAI {
    const apiKey = configManager.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not configured');
    return new OpenAI({ apiKey });
  }

  isConfigured(): boolean {
    return !!configManager.getApiKey('openai');
  }

  async listModels(): Promise<ModelInfo[]> {
    const client = this.getClient();
    const models = await client.models.list();
    return models.data
      .filter((m) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
      .map((m) => ({
        id: m.id,
        name: m.id,
        tags: this.inferTags(m.id),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private inferTags(id: string): string[] {
    const tags: string[] = [];
    if (id.includes('gpt-4')) tags.push('coding', 'reasoning');
    if (id.includes('mini') || id.includes('turbo')) tags.push('fast');
    if (id.includes('o1') || id.includes('o3')) tags.push('reasoning');
    if (id.includes('vision')) tags.push('vision');
    return tags;
  }

  async chat(options: ChatOptions): Promise<string> {
    const client = this.getClient();
    const messages = this.buildMessages(options) as Array<OpenAI.ChatCompletionMessageParam>;
    const response = await client.chat.completions.create({
      model: options.model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    });
    return response.choices[0]?.message?.content || '';
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const client = this.getClient();
    const messages = this.buildMessages(options) as Array<OpenAI.ChatCompletionMessageParam>;
    const stream = await client.chat.completions.create({
      model: options.model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      const done = chunk.choices[0]?.finish_reason === 'stop';
      if (content) yield { content, done: false };
      if (done) yield { content: '', done: true };
    }
  }
}
