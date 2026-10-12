import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { auditProject } from '../src/audit.js';
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

test('auditProject audits depshred self correctly', async () => {
  const projectDir = resolve('.');
  const result = await auditProject({ path: projectDir });

  assert.equal(result.totalDependencies, 1);
  assert.equal(result.summary.critical, 0);
  assert.equal(result.summary.unused, 0);
  assert.equal(result.summary.ok, 1);

  const pico = result.results.find((r) => r.name === 'picocolors');
  assert.ok(pico);
  assert.equal(pico.tier, 'OK');
  assert.ok(pico.imports.length >= 3, 'Should detect imports in cli, interactive, reporter');
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
