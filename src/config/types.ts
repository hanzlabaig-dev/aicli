export type ProviderName = 'openrouter' | 'anthropic' | 'openai' | 'gemini' | 'ollama';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
}

export interface GitHubConfig {
  token?: string;
  defaultOwner?: string;
}

export interface ThemeConfig {
  name: 'dark' | 'light' | 'system';
  primaryColor: string;
  codeTheme: string;
}

export interface AppConfig {
  version: string;
  activeProvider: ProviderName;
  providers: Record<ProviderName, ProviderConfig>;
  github: GitHubConfig;
  theme: ThemeConfig;
  maxContextTokens: number;
  streamingEnabled: boolean;
  autoIndex: boolean;
  historySize: number;
  projectPaths: string[];
  telemetry: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  id: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  provider: ProviderName;
  model: string;
  messages: Message[];
  projectPath?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

export interface ProjectContext {
  path: string;
  language: string[];
  framework?: string;
  packageManager?: string;
  files: string[];
  structure: Record<string, unknown>;
}
