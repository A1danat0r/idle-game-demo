declare const __BUILD_LABEL__: string;
declare const __COMMIT_SHA__: string;

declare module '*.css?raw' {
  const css: string;
  export default css;
}

declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
}

declare module 'node:child_process' {
  export interface ChildProcess {
    kill(signal?: string): boolean;
  }
  export function spawn(
    command: string,
    args: readonly string[],
    options: { cwd?: string; stdio?: 'ignore' },
  ): ChildProcess;
}
