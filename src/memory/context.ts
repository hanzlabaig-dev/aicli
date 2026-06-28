import { Message } from '../config/types';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

/**
 * Rough token estimation: ~4 chars per token for English text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * ContextManager handles pruning the conversation message list so it never
 * exceeds the configured token budget. It always preserves the system prompt
 * and the most recent exchange, dropping older messages from the middle when
 * the context grows too large.
 */
export class ContextManager {
  private systemPromptTokens = 0;

  setSystemPromptTokens(tokens: number): void {
    this.systemPromptTokens = tokens;
  }

  /**
   * Return a trimmed copy of messages that fits inside maxContextTokens.
   * Strategy:
   *  1. Always keep the first message if it is a user "bootstrap" message.
   *  2. Drop oldest assistant/user pairs from the front until we fit.
   *  3. Always keep the very last user message.
   */
  trim(messages: Message[], maxTokens?: number): Message[] {
    const limit = (maxTokens ?? configManager.get().maxContextTokens) - this.systemPromptTokens;
    if (limit <= 0) return messages.slice(-2);

    // Calculate total tokens
    let total = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    if (total <= limit) return messages;

    // Drop from the front (oldest first) but always keep the last message
    const result = [...messages];
    while (result.length > 1 && total > limit) {
      const removed = result.shift()!;
      total -= estimateTokens(removed.content);
    }

    logger.debug('Context trimmed', { remaining: result.length, estimatedTokens: total });
    return result;
  }

  /**
   * Build a compact summary of older messages to inject as a single context
   * message instead of raw history — useful for very long sessions.
   */
  summarize(messages: Message[]): string {
    if (messages.length === 0) return '';
    const lines = messages.map(
      (m) =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '…' : ''}`
    );
    return `[Conversation summary — ${messages.length} earlier messages]\n${lines.join('\n')}`;
  }

  /**
   * Returns true if the messages are close to the context limit.
   */
  isNearLimit(messages: Message[], threshold = 0.85): boolean {
    const limit = configManager.get().maxContextTokens - this.systemPromptTokens;
    const total = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    return total / limit >= threshold;
  }

  estimateTotal(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  }
}

export const contextManager = new ContextManager();
