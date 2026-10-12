/**
 * Modern Lightweight Package Alternatives Catalog.
 * Objective replacements for heavy or legacy packages.
 */
export const ALT_RULES = [
  {
    name: 'zod',
    lighter: 'valibot',
    description: 'Zod is ~5.9MB unpacked (~14KB gzipped). Replace with valibot (modular, sub-1KB per schema) or arktype for 10x smaller bundles.',
    savings: '~5.5MB unpacked (~90% bundle reduction)'
  },
  {
    name: 'moment',
    lighter: 'dayjs',
    description: 'Heavy legacy date library (~4.2MB unpacked). Replace with dayjs (API-compatible) or native Intl.',
    savings: '~4MB'
  },
  {
    name: 'lodash',
    lighter: 'es-toolkit',
    description: 'Monolithic utility bundle. Replace with native ES6+ methods (structuredClone, Array methods) or es-toolkit.',
    savings: '~1.5MB'
  },
  {
    name: 'chalk',
    lighter: 'picocolors',
    description: 'Large dependency chain in v4/v5. Replace with picocolors (sub-7KB, 0 sub-dependencies).',
    savings: '~100KB'
  },
  {
    name: 'classnames',
    lighter: 'clsx',
    description: 'Legacy classnames utility. Replace with clsx (drop-in API, faster, zero dependencies).',
    savings: '~50KB'
  },
  {
    name: 'bcrypt',
    lighter: 'bcryptjs',
    description: 'Requires node-gyp C++ compilation toolchain. Replace with pure JS bcryptjs or native crypto.scrypt.',
    savings: 'Eliminates native build toolchain dependency'
  },
  {
    name: 'deep-equal',
    lighter: 'fast-deep-equal',
    description: 'Legacy recursive comparison. Replace with fast-deep-equal (sub-1KB, faster) or native assert.deepStrictEqual.',
    savings: '~80% faster and 0 sub-dependencies'
  },
  {
    name: 'request',
    lighter: 'fetch / ky',
    description: 'Deprecated HTTP client (~5MB unpacked). Replace with native global fetch() or ky.',
    savings: '~5MB unpacked'
  },
  {
    name: 'superagent',
    lighter: 'fetch / ky',
    description: 'Heavy legacy HTTP client (~1.8MB unpacked). Replace with native global fetch() or ky.',
    savings: '~1.8MB unpacked'
  },
  {
    name: 'bluebird',
    lighter: 'native Promise',
    description: 'Legacy Promise library (~1.5MB unpacked). Replace with native V8 Promise and async/await.',
    savings: '~1.5MB unpacked'
  },
  {
    name: 'yargs',
    lighter: 'node:util parseArgs / citty',
    description: 'Heavy CLI parser (~2.5MB unpacked). Replace with native node:util parseArgs() or citty.',
    savings: '~2.5MB unpacked'
  },
  {
    name: 'ora',
    lighter: 'yocto-spinner',
    description: 'Terminal spinner with large dependency tree. Replace with yocto-spinner (sub-5KB) or native console writes.',
    savings: '~200KB unpacked'
  },
  {
    name: 'qs',
    lighter: 'URLSearchParams',
    description: 'Query string parser (~200KB unpacked). For standard flat queries, replace with native URLSearchParams.',
    savings: '~200KB unpacked'
  }
];
