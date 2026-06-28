describe('Terminal Utils', () => {
  beforeAll(() => {
    jest.resetModules();
  });

  it('should truncate long strings', () => {
    const { truncate } = require('../../src/utils/terminal');
    expect(truncate('hello world', 8)).toBe('hello...');
    expect(truncate('short', 10)).toBe('short');
  });

  it('should format bytes', () => {
    const { formatBytes } = require('../../src/utils/terminal');
    expect(formatBytes(500)).toBe('500B');
    expect(formatBytes(1536)).toBe('1.5KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0MB');
  });

  it('should render diff with colors', () => {
    const { renderDiff } = require('../../src/utils/terminal');
    const diff = `--- old\n+++ new\n@@ -1,2 +1,2 @@\n-old line\n+new line`;
    const rendered = renderDiff(diff);
    expect(rendered).toContain('old line');
    expect(rendered).toContain('new line');
  });

  it('should format table', () => {
    const { formatTable } = require('../../src/utils/terminal');
    const result = formatTable(['Name', 'Value'], [['foo', 'bar'], ['baz', 'qux']]);
    expect(result).toContain('Name');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });
});
