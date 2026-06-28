declare module 'marked-terminal' {
  import { MarkedExtension } from 'marked';
  function markedTerminal(options?: Record<string, unknown>): MarkedExtension;
  export { markedTerminal };
}
