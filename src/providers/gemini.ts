import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider, ModelInfo, ChatOptions } from './base';
import { StreamChunk } from '../config/types';
import { configManager } from '../config/manager';

const GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextLength: 2000000, tags: ['vision', 'large-context', 'reasoning'] },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextLength: 1000000, tags: ['fast', 'vision', 'large-context'] },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', contextLength: 1000000, tags: ['fast', 'free'] },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (exp)', contextLength: 1000000, tags: ['fast', 'reasoning'] },
];

export class GeminiProvider extends BaseProvider {
  readonly name = 'gemini';
  readonly displayName = 'Google Gemini';

  private getClient(): GoogleGenerativeAI {
    const apiKey = configManager.getApiKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');
    return new GoogleGenerativeAI(apiKey);
  }

  isConfigured(): boolean {
    return !!configManager.getApiKey('gemini');
  }

  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }

  async chat(options: ChatOptions): Promise<string> {
    const client = this.getClient();
    const model = client.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt,
    });

    const history = options.messages.slice(0, -1)
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const chat = model.startChat({ history });
    const lastMsg = options.messages[options.messages.length - 1];
    const result = await chat.sendMessage(lastMsg.content);
    return result.response.text();
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const client = this.getClient();
    const model = client.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt,
    });

    const history = options.messages.slice(0, -1)
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const chat = model.startChat({ history });
    const lastMsg = options.messages[options.messages.length - 1];
    const result = await chat.sendMessageStream(lastMsg.content);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield { content: text, done: false };
    }
    yield { content: '', done: true };
  }
}
