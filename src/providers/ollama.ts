import axios from 'axios';
import { BaseProvider, ModelInfo, ChatOptions } from './base';
import { StreamChunk } from '../config/types';
import { configManager } from '../config/manager';

export class OllamaProvider extends BaseProvider {
  readonly name = 'ollama';
  readonly displayName = 'Ollama (Local)';

  private getBaseUrl(): string {
    return configManager.getProvider('ollama').baseUrl || 'http://localhost:11434';
  }

  isConfigured(): boolean {
    return true; // Ollama doesn't need an API key
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${this.getBaseUrl()}/api/tags`, { timeout: 5000 });
      return (response.data.models || []).map((m: { name: string; details?: { parameter_size?: string } }) => ({
        id: m.name,
        name: m.name,
        tags: ['local', 'offline'],
        description: m.details?.parameter_size ? `${m.details.parameter_size} parameters` : undefined,
      }));
    } catch {
      throw new Error('Ollama is not running. Start it with: ollama serve');
    }
  }

  async chat(options: ChatOptions): Promise<string> {
    const messages = this.buildMessages(options);
    const response = await axios.post(
      `${this.getBaseUrl()}/api/chat`,
      {
        model: options.model,
        messages,
        stream: false,
        options: { temperature: options.temperature ?? 0.7 },
      },
      { timeout: 120000 }
    );
    return response.data.message?.content || '';
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const messages = this.buildMessages(options);
    const response = await axios.post(
      `${this.getBaseUrl()}/api/chat`,
      {
        model: options.model,
        messages,
        stream: true,
        options: { temperature: options.temperature ?? 0.7 },
      },
      { responseType: 'stream', timeout: 120000 }
    );

    let buffer = '';
    for await (const chunk of response.data) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const content = data.message?.content || '';
          if (content) yield { content, done: false };
          if (data.done) yield { content: '', done: true };
        } catch { /* skip */ }
      }
    }
    yield { content: '', done: true };
  }
}
