import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AppConfig, ProviderName, ProviderConfig } from './types';
import { logger } from '../utils/logger';

const CONFIG_DIR = path.join(os.homedir(), '.aicli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  activeProvider: 'openrouter',
  providers: {
    openrouter: { enabled: true, defaultModel: 'openai/gpt-4o-mini' },
    anthropic: { enabled: false, defaultModel: 'claude-3-5-sonnet-20241022' },
    openai: { enabled: false, defaultModel: 'gpt-4o-mini' },
    gemini: { enabled: false, defaultModel: 'gemini-1.5-flash' },
    ollama: { enabled: false, baseUrl: 'http://localhost:11434', defaultModel: 'llama3.1' },
  },
  github: {},
  theme: { name: 'dark', primaryColor: 'cyan', codeTheme: 'github-dark' },
  maxContextTokens: 128000,
  streamingEnabled: true,
  autoIndex: true,
  historySize: 1000,
  projectPaths: [],
  telemetry: false,
};

class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    this.configPath = CONFIG_FILE;
    this.config = DEFAULT_CONFIG;
    this.load();
  }

  private load(): void {
    try {
      fs.ensureDirSync(CONFIG_DIR);
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(raw) as Partial<AppConfig>;
        this.config = this.merge(DEFAULT_CONFIG, loaded);
      } else {
        this.save();
      }
    } catch (err) {
      logger.error('Failed to load config', { err });
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private merge(defaults: AppConfig, overrides: Partial<AppConfig>): AppConfig {
    return {
      ...defaults,
      ...overrides,
      providers: {
        ...defaults.providers,
        ...(overrides.providers || {}),
        openrouter: { ...defaults.providers.openrouter, ...(overrides.providers?.openrouter || {}) },
        anthropic: { ...defaults.providers.anthropic, ...(overrides.providers?.anthropic || {}) },
        openai: { ...defaults.providers.openai, ...(overrides.providers?.openai || {}) },
        gemini: { ...defaults.providers.gemini, ...(overrides.providers?.gemini || {}) },
        ollama: { ...defaults.providers.ollama, ...(overrides.providers?.ollama || {}) },
      },
      github: { ...defaults.github, ...(overrides.github || {}) },
      theme: { ...defaults.theme, ...(overrides.theme || {}) },
    };
  }

  save(): void {
    try {
      fs.ensureDirSync(CONFIG_DIR);
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to save config', { err });
    }
  }

  get(): AppConfig {
    return this.config;
  }

  getProvider(name: ProviderName): ProviderConfig {
    return this.config.providers[name];
  }

  setProvider(name: ProviderName, cfg: Partial<ProviderConfig>): void {
    this.config.providers[name] = { ...this.config.providers[name], ...cfg };
    this.save();
  }

  setApiKey(provider: ProviderName, key: string): void {
    // Never log API keys
    this.config.providers[provider].apiKey = key;
    this.config.providers[provider].enabled = true;
    this.save();
    logger.info(`API key updated for provider: ${provider}`);
  }

  getApiKey(provider: ProviderName): string | undefined {
    const env: Record<ProviderName, string> = {
      openrouter: 'OPENROUTER_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      gemini: 'GEMINI_API_KEY',
      ollama: '',
    };
    return process.env[env[provider]] || this.config.providers[provider].apiKey;
  }

  setActiveProvider(provider: ProviderName): void {
    this.config.activeProvider = provider;
    this.save();
  }

  setDefaultModel(provider: ProviderName, model: string): void {
    this.config.providers[provider].defaultModel = model;
    this.save();
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  getConfigDir(): string {
    return CONFIG_DIR;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  reload(): void {
    this.load();
  }
}

export const configManager = new ConfigManager();
