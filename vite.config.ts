import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: '/idle-game-demo/',
  define: {
    __BUILD_LABEL__: JSON.stringify('demo-dev'),
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
});
