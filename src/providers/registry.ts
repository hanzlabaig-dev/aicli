import { BaseProvider } from './base';
import { OpenRouterProvider } from './openrouter';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { ProviderName } from '../config/types';
import { configManager } from '../config/manager';

class ProviderRegistry {
  private providers: Map<ProviderName, BaseProvider>;

  constructor() {
    this.providers = new Map<ProviderName, BaseProvider>();
    this.providers.set('openrouter', new OpenRouterProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('ollama', new OllamaProvider());
  }

  get(name: ProviderName): BaseProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Unknown provider: ${name}`);
    return provider;
  }

  getActive(): BaseProvider {
    return this.get(configManager.get().activeProvider);
  }

  getActiveModel(): string {
    const { activeProvider } = configManager.get();
    return configManager.get().providers[activeProvider].defaultModel || '';
  }

  list(): Array<{ name: ProviderName; provider: BaseProvider; configured: boolean }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      provider,
      configured: provider.isConfigured(),
    }));
  }

  all(): BaseProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
