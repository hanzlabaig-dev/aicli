import { ProviderName } from '../config/types';

export interface CLIState {
  currentModel: string;
  currentProvider: ProviderName;
  projectPath: string;
  isIndexed: boolean;
  isStreaming: boolean;
  theme: string;
  exitRequested: boolean;
}

export function createInitialState(projectPath: string, provider: ProviderName, model: string): CLIState {
  return {
    currentModel: model,
    currentProvider: provider,
    projectPath,
    isIndexed: false,
    isStreaming: false,
    theme: 'dark',
    exitRequested: false,
  };
}
