import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { auditProject } from '../src/audit.js';
import { checkPackageUsage, EXIT_CODES } from '../src/checker.js';
import { getNativeRule, getAltRule, compareVersions } from '../src/rules/index.js';

test('compareVersions accurately compares semantic versions', () => {
  assert.equal(compareVersions('20.6.0', '18.0.0'), 1);
  assert.equal(compareVersions('18.0.0', '20.6.0'), -1);
  assert.equal(compareVersions('20.6.0', '20.6.0'), 0);
  assert.equal(compareVersions('v22.13.1', '22.0.0'), 1);
});

test('getNativeRule checks version support boundaries', () => {
  const dotenvOn18 = getNativeRule('dotenv', '18.0.0');
  assert.equal(dotenvOn18.isSupported, false, 'dotenv should not be supported on Node 18');

  const dotenvOn20 = getNativeRule('dotenv', '20.6.0');
  assert.equal(dotenvOn20.isSupported, true, 'dotenv should be supported on Node 20.6.0');

  const globOn20 = getNativeRule('glob', '20.0.0');
  assert.equal(globOn20.isSupported, false, 'glob requires Node 22+');

  const globOn22 = getNativeRule('glob', '22.0.0');
  assert.equal(globOn22.isSupported, true, 'glob should be supported on Node 22');
});

test('getNativeRule detects modern web standards and Node utilities', () => {
  const formData = getNativeRule('form-data', '18.0.0');
  assert.ok(formData, 'form-data rule must exist');
  assert.equal(formData.isSupported, true, 'form-data is supported in Node 18+');

  const crossFetch = getNativeRule('cross-fetch', '18.0.0');
  assert.ok(crossFetch, 'cross-fetch rule must exist');
  assert.equal(crossFetch.isSupported, true, 'cross-fetch is supported in Node 18+');

  const stripAnsi18 = getNativeRule('strip-ansi', '18.0.0');
  assert.ok(stripAnsi18);
  assert.equal(stripAnsi18.isSupported, false, 'strip-ansi requires Node 20.13.0+');

  const stripAnsi22 = getNativeRule('strip-ansi', '22.0.0');
  assert.equal(stripAnsi22.isSupported, true, 'strip-ansi is supported in Node 22+');

  const minimist16 = getNativeRule('minimist', '16.0.0');
  assert.equal(minimist16.isSupported, false, 'minimist requires Node 18.3.0+ for parseArgs');

  const minimist18 = getNativeRule('minimist', '18.3.0');
  assert.equal(minimist18.isSupported, true, 'minimist is supported in Node 18.3.0+');

  const isPromise = getNativeRule('is-promise', '18.0.0');
  assert.ok(isPromise);
  assert.equal(isPromise.isSupported, true);

  const leftPad = getNativeRule('left-pad', '18.0.0');
  assert.ok(leftPad);
  assert.equal(leftPad.isSupported, true);
});

test('getNativeRule detects core module shadows', () => {
  const shadows = ['path', 'crypto', 'url', 'buffer', 'os', 'fs', 'util', 'events', 'string_decoder', 'timers'];
  for (const mod of shadows) {
    const rule = getNativeRule(mod, '18.0.0');
    assert.ok(rule, `shadow rule for ${mod} should exist`);
    assert.equal(rule.isSupported, true, `shadow rule for ${mod} should be supported`);
    assert.ok(rule.description.includes('shadowing'), `description should flag shadowing for ${mod}`);
  }
});

test('getAltRule recommends lightweight alternatives', () => {
  const zodRule = getAltRule('zod');
  assert.ok(zodRule);
  assert.equal(zodRule.lighter, 'valibot');

  const requestRule = getAltRule('request');
  assert.ok(requestRule);
  assert.ok(requestRule.description.includes('fetch'));

  const bluebirdRule = getAltRule('bluebird');
  assert.ok(bluebirdRule);
  assert.equal(bluebirdRule.lighter, 'native Promise');

  const yargsRule = getAltRule('yargs');
  assert.ok(yargsRule);
  assert.ok(yargsRule.lighter.includes('parseArgs'));

  const oraRule = getAltRule('ora');
  assert.ok(oraRule);
  assert.equal(oraRule.lighter, 'yocto-spinner');
});

test('auditProject audits depshred self correctly (true zero runtime dependencies)', async () => {
  const projectDir = resolve('.');
  const result = await auditProject({ path: projectDir });

  assert.equal(result.totalDependencies, 0, 'depshred must have 0 runtime dependencies');
  assert.equal(result.summary.critical, 0);
  assert.equal(result.summary.unused, 0);
  assert.equal(result.summary.ok, 0);
  assert.equal(result.results.length, 0);
});

test('colors helper formats and respects gating', async () => {
  const { pc } = await import('../src/colors.js');
  assert.equal(typeof pc.red, 'function');
  assert.equal(typeof pc.green, 'function');
  assert.equal(typeof pc.bold, 'function');
  assert.equal(typeof pc.dim, 'function');
  assert.equal(typeof pc.yellow, 'function');
  assert.equal(typeof pc.cyan, 'function');
  assert.equal(typeof pc.magenta, 'function');
  assert.equal(typeof pc.white, 'function');
  assert.equal(typeof pc.gray, 'function');
  assert.equal(typeof pc.bold('hello'), 'string');
});

test('auditProject audits legacy-app fixture with unused and native replacements', async () => {
  const fixtureDir = resolve('./test/fixtures/legacy-app');
  const result = await auditProject({ path: fixtureDir });

  assert.equal(result.totalDependencies, 3);
  assert.equal(result.summary.critical, 2, 'uuid and dotenv should be critical');
  assert.equal(result.summary.unused, 1, 'rimraf should be unused');

  const rimraf = result.results.find((r) => r.name === 'rimraf');
  assert.ok(rimraf);
  assert.equal(rimraf.tier, 'UNUSED');
  assert.equal(rimraf.action, 'npm uninstall rimraf');

  const uuid = result.results.find((r) => r.name === 'uuid');
  assert.ok(uuid);
  assert.equal(uuid.tier, 'CRITICAL');
  assert.equal(uuid.imports.length, 1);
  assert.equal(uuid.imports[0].line, 1);
});

test('auditProject respects ignore option', async () => {
  const fixtureDir = resolve('./test/fixtures/legacy-app');
  const result = await auditProject({ path: fixtureDir, ignore: ['rimraf', 'uuid'] });

  const rimraf = result.results.find((r) => r.name === 'rimraf');
  assert.equal(rimraf.tier, 'OK');
  assert.equal(rimraf.status, 'IGNORED');

  const uuid = result.results.find((r) => r.name === 'uuid');
  assert.equal(uuid.tier, 'OK');
  assert.equal(uuid.status, 'IGNORED');

  assert.equal(result.summary.unused, 0);
  assert.equal(result.summary.critical, 1, 'only dotenv remains critical');
});

test('locateImports recognizes packages referenced in package.json scripts', async () => {
  const { locateImports } = await import('../src/locator.js');
  const scripts = {
    dev: 'nodemon index.js',
    clean: 'rimraf dist'
  };
  const { importsMap, unusedPackages } = await locateImports('.', ['nodemon', 'rimraf', 'unused-lib'], scripts);

  assert.ok(importsMap.has('nodemon'), 'nodemon should be recognized from scripts');
  assert.ok(importsMap.has('rimraf'), 'rimraf should be recognized from scripts');
  assert.deepEqual(unusedPackages, ['unused-lib'], 'only unused-lib should be unused');
});

test('locateImports ignores depshred self and recognizes ambient @types', async () => {
  const { locateImports } = await import('../src/locator.js');
  const { importsMap, unusedPackages } = await locateImports('.', ['depshred', '@types/node', 'really-unused'], {});

  assert.ok(importsMap.has('depshred'), 'depshred should self-ignore');
  assert.ok(importsMap.has('@types/node'), '@types/node should be recognized as ambient type');
  assert.deepEqual(unusedPackages, ['really-unused'], 'only really-unused should be unused');
});

test('locateImports recognizes Babel compiler infrastructure and plugins', async () => {
  const { locateImports } = await import('../src/locator.js');
  const deps = ['@rolldown/plugin-babel', '@babel/core', 'babel-plugin-react-compiler', 'unused-lib'];
  const { importsMap, unusedPackages } = await locateImports('.', deps, {});

  assert.ok(importsMap.has('@babel/core'), '@babel/core should be recognized as compiler engine');
  assert.ok(importsMap.has('babel-plugin-react-compiler'), 'babel-plugin-react-compiler should be recognized');
  assert.deepEqual(unusedPackages, ['unused-lib'], 'only unused-lib should be unused');
});

test('stripComments strips single-line and multi-line comments while preserving newlines', async () => {
  const { stripComments } = await import('../src/locator.js');
  const sample = [
    '// import "fake-a";',
    'const a = 1;',
    '/* multiline',
    'import "fake-b";',
    '*/',
    'const b = 2;'
  ].join('\n');

  const stripped = stripComments(sample);
  assert.ok(!stripped.includes('fake-a'), 'Should not contain single-line comment');
  assert.ok(!stripped.includes('fake-b'), 'Should not contain block comment');
  assert.ok(stripped.includes('const a = 1;'));
  assert.ok(stripped.includes('const b = 2;'));
  assert.equal(stripped.split('\n').length, sample.split('\n').length, 'Must preserve line count for exact line numbers');
});

test('extractScriptContent extracts only script blocks from Vue and Svelte components', async () => {
  const { extractScriptContent } = await import('../src/locator.js');
  const vueComponent = [
    '<template>',
    '  <button>Click</button>',
    '</template>',
    '<script setup lang="ts">',
    'import { ref } from "vue";',
    'import { helper } from "vue-helper";',
    '</script>',
    '<style>',
    'button { color: red; }',
    '</style>'
  ].join('\n');

  const extracted = extractScriptContent(vueComponent, '.vue');
  assert.ok(extracted.includes('vue-helper'), 'Must extract script block imports');
  assert.ok(!extracted.includes('<template>'), 'Must exclude template block');
  assert.ok(!extracted.includes('<style>'), 'Must exclude style block');
});

test('locateImports accurately recognizes all TypeScript type-only imports and multi-line imports', async () => {
  const { locateImports } = await import('../src/locator.js');
  const { writeFile, mkdir, rm } = await import('node:fs/promises');
  const tempTestDir = resolve('./test/fixtures/ts-type-app');

  await mkdir(tempTestDir, { recursive: true });
  await writeFile(resolve(tempTestDir, 'package.json'), JSON.stringify({
    name: 'ts-type-app',
    dependencies: {
      'pkg-type-import': '1.0.0',
      'pkg-inline-type': '1.0.0',
      'pkg-export-type': '1.0.0',
      'pkg-multiline': '1.0.0',
      'pkg-cjs-multiline': '1.0.0',
      'pkg-commented-unused': '1.0.0'
    }
  }, null, 2));

  const sampleSource = [
    '// import "pkg-commented-unused";',
    '/* import "pkg-commented-unused"; */',
    'import type { User } from "pkg-type-import";',
    'import { type Config, run } from "pkg-inline-type";',
    'export type { Output } from "pkg-export-type";',
    'import {',
    '  type Item,',
    '  processItem',
    '} from "pkg-multiline";',
    'const cjs = require(',
    '  "pkg-cjs-multiline"',
    ');'
  ].join('\n');

  await writeFile(resolve(tempTestDir, 'index.ts'), sampleSource);

  try {
    const deps = [
      'pkg-type-import',
      'pkg-inline-type',
      'pkg-export-type',
      'pkg-multiline',
      'pkg-cjs-multiline',
      'pkg-commented-unused'
    ];
    const { importsMap, unusedPackages } = await locateImports(tempTestDir, deps, {});

    assert.ok(importsMap.has('pkg-type-import'), 'Should recognize import type');
    assert.ok(importsMap.has('pkg-inline-type'), 'Should recognize import { type X, y }');
    assert.ok(importsMap.has('pkg-export-type'), 'Should recognize export type { X }');
    assert.ok(importsMap.has('pkg-multiline'), 'Should recognize multi-line import');
    assert.ok(importsMap.has('pkg-cjs-multiline'), 'Should recognize multi-line require');

    assert.deepEqual(unusedPackages, ['pkg-commented-unused'], 'Only commented-out package should be flagged as unused');
  } finally {
    await rm(tempTestDir, { recursive: true, force: true });
  }
});


test('checkPackageUsage emits accurate verdicts for axios (safe vs not a drop-in vs cannot determine)', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const tempDir = await mkdtemp(join(tmpdir(), 'depshred-check-axios-'));

  try {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({
      name: 'axios-check-fixture',
      dependencies: { axios: '^1.7.0' }
    }));

    // 1. Safe case: direct axios.get
    await writeFile(join(tempDir, 'app.js'), 'import axios from "axios";\nconst res = await axios.get("https://example.com");');
    const safeReport = await checkPackageUsage(tempDir, 'axios');
    assert.equal(safeReport.verdict, 'safe');
    assert.equal(EXIT_CODES[safeReport.verdict], 0);
    assert.ok(safeReport.behaviorDifferences.length > 0, 'Should outline behavior differences like 4xx/5xx rejection');

    // 2. Not a drop-in: interceptors
    await writeFile(join(tempDir, 'app.js'), 'import axios from "axios";\naxios.interceptors.request.use(cfg => cfg);');
    const unsafeReport = await checkPackageUsage(tempDir, 'axios');
    assert.equal(unsafeReport.verdict, 'not a drop-in');
    assert.equal(EXIT_CODES[unsafeReport.verdict], 2);
    assert.ok(unsafeReport.reason.includes('interceptors'));

    // 3. Can\'t determine: axios.create instance
    await writeFile(join(tempDir, 'app.js'), 'import axios from "axios";\nconst client = axios.create();\nclient.get("/data");');
    const ambiguousReport = await checkPackageUsage(tempDir, 'axios');
    assert.equal(ambiguousReport.verdict, "can't determine");
    assert.equal(EXIT_CODES[ambiguousReport.verdict], 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('checkPackageUsage emits accurate verdicts for uuid (safe v4 vs not a drop-in v1)', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const tempDir = await mkdtemp(join(tmpdir(), 'depshred-check-uuid-'));

  try {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({
      name: 'uuid-check-fixture',
      dependencies: { uuid: '^9.0.0' }
    }));

    // 1. Safe: uuid v4
    await writeFile(join(tempDir, 'app.js'), 'import { v4 as uuidv4 } from "uuid";\nconst id = uuidv4();');
    const safeReport = await checkPackageUsage(tempDir, 'uuid');
    assert.equal(safeReport.verdict, 'safe');
    assert.equal(EXIT_CODES[safeReport.verdict], 0);

    // 2. Not a drop-in: uuid v1
    await writeFile(join(tempDir, 'app.js'), 'import { v1 } from "uuid";\nconst id = v1();');
    const unsafeReport = await checkPackageUsage(tempDir, 'uuid');
    assert.equal(unsafeReport.verdict, 'not a drop-in');
    assert.equal(EXIT_CODES[unsafeReport.verdict], 2);
    assert.ok(unsafeReport.reason.includes('non-v4'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('auditProject ingests upstream Knip report via --from-knip flag', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const tempDir = await mkdtemp(join(tmpdir(), 'depshred-knip-test-'));

  try {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({
      name: 'knip-fixture',
      dependencies: {
        'active-dep': '^1.0.0',
        'knip-flagged-dep': '^2.0.0'
      }
    }, null, 2));

    await writeFile(join(tempDir, 'index.js'), 'import "active-dep";\nconsole.log("running");');

    const knipReportPath = join(tempDir, 'knip-report.json');
    await writeFile(knipReportPath, JSON.stringify({
      dependencies: ['knip-flagged-dep']
    }, null, 2));

    const audit = await auditProject({
      path: tempDir,
      fromKnip: knipReportPath
    });

    const knipFinding = audit.results.find(item => item.name === 'knip-flagged-dep');
    assert.ok(knipFinding, 'knip-flagged-dep should be identified');
    assert.equal(knipFinding.tier, 'UNUSED');
    assert.equal(knipFinding.status, 'KNIP_UNUSED');
    assert.ok(knipFinding.details.includes('[Knip Upstream Finding]'), 'Details must label [Knip Upstream Finding]');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
