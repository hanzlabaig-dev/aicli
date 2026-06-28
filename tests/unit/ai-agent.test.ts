jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('AI Agent', () => {
  let aiAgent: any;

  beforeEach(() => {
    jest.resetModules();
    aiAgent = require('../../src/cli/ai-agent');
  });

  it('should parse tool calls from response', () => {
    const response = `I'll create that file for you.
\`\`\`tool
{"tool": "create_file", "path": "src/utils.ts", "content": "export const x = 1;"}
\`\`\`
Done!`;
    const calls = aiAgent.parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe('create_file');
    expect(calls[0].path).toBe('src/utils.ts');
    expect(calls[0].content).toBe('export const x = 1;');
  });

  it('should parse multiple tool calls', () => {
    const response = `
\`\`\`tool
{"tool": "read_file", "path": "package.json"}
\`\`\`
\`\`\`tool
{"tool": "list_files", "path": "src"}
\`\`\`
`;
    const calls = aiAgent.parseToolCalls(response);
    expect(calls).toHaveLength(2);
    expect(calls[0].tool).toBe('read_file');
    expect(calls[1].tool).toBe('list_files');
  });

  it('should return empty array when no tool calls', () => {
    const response = 'Here is some plain text without any tool calls.';
    const calls = aiAgent.parseToolCalls(response);
    expect(calls).toHaveLength(0);
  });

  it('should ignore malformed tool calls', () => {
    const response = `
\`\`\`tool
{invalid json here
\`\`\`
\`\`\`tool
{"tool": "read_file", "path": "valid.ts"}
\`\`\`
`;
    const calls = aiAgent.parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe('read_file');
  });

  it('should build system prompt with project context', () => {
    const state = {
      projectPath: '/test/project',
      currentProvider: 'openrouter',
      currentModel: 'gpt-4o',
      isIndexed: false,
      isStreaming: false,
      theme: 'dark',
      exitRequested: false,
    };
    const prompt = aiAgent.buildSystemPrompt(state);
    expect(prompt).toContain('AICLI');
    expect(prompt).toContain('/test/project');
    expect(prompt).toContain('read_file');
    expect(prompt).toContain('create_file');
  });
});
