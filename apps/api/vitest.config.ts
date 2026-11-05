import { defineConfig } from 'vitest/config';

// Each worker boots a PostgreSQL WASM engine in local tests. Bound memory/CPU
// rather than timing out permission checks when all suites start together.
export default defineConfig({ test: { maxWorkers: 2, testTimeout: 30000, hookTimeout: 30000 } });
