import axios from 'axios';
import { BaseProvider, ModelInfo, ChatOptions } from './base';
import { StreamChunk } from '../config/types';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt: string; completion: string };
  architecture?: { modality?: string };
}

export class OpenRouterProvider extends BaseProvider {
  readonly name = 'openrouter';
  readonly displayName = 'OpenRouter';
  private baseUrl = 'https://openrouter.ai/api/v1';

  isConfigured(): boolean {
    return !!configManager.getApiKey('openrouter');
  }

  async listModels(): Promise<ModelInfo[]> {
    const apiKey = configManager.getApiKey('openrouter');
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const response = await axios.get(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return (response.data.data as OpenRouterModel[]).map((m) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description,
      contextLength: m.context_length,
      pricing: m.pricing
        ? {
            prompt: parseFloat(m.pricing.prompt) * 1_000_000,
            completion: parseFloat(m.pricing.completion) * 1_000_000,
          }
        : undefined,
      tags: this.inferTags(m),
    }));
  }

  private inferTags(model: OpenRouterModel): string[] {
    const tags: string[] = [];
    const name = (model.name || model.id).toLowerCase();
    if (name.includes('code') || name.includes('coder')) tags.push('coding');
    if (name.includes('vision') || model.architecture?.modality?.includes('image')) tags.push('vision');
    if ((model.context_length || 0) >= 100000) tags.push('large-context');
    if (model.pricing && parseFloat(model.pricing.prompt) === 0) tags.push('free');
    if (name.includes('reason') || name.includes('o1') || name.includes('o3') || name.includes('thinking')) tags.push('reasoning');
    return tags;
  }

  async chat(options: ChatOptions): Promise<string> {
    const apiKey = configManager.getApiKey('openrouter');
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const messages = this.buildMessages(options);
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: options.model,
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/thebitforge/aicli',
          'X-Title': 'AICLI',
        },
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const apiKey = configManager.getApiKey('openrouter');
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const messages = this.buildMessages(options);

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: options.model,
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/thebitforge/aicli',
          'X-Title': 'AICLI',
        },
        responseType: 'stream',
      }
    );

    let buffer = '';

    for await (const chunk of response.data) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          const content = data.choices?.[0]?.delta?.content || '';
          if (content) {
            yield { content, done: false };
          }
          if (data.choices?.[0]?.finish_reason === 'stop') {
            yield { content: '', done: true };
            return;
          }
        } catch (err) {
          logger.debug('Failed to parse SSE chunk', { err });
        }
      }
    }

    yield { content: '', done: true };
  }
}
