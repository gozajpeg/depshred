/**
 * Native Node.js Standard Library Replacement Catalog.
 * Maps legacy npm packages to native Node.js APIs available in modern releases.
 */
export const NATIVE_RULES = [
  {
    name: 'dotenv',
    minNode: '20.6.0',
    description: 'Native CLI flag node --env-file=.env',
    diff: `// Before:
import 'dotenv/config';

// After (zero code, launch with CLI flag):
node --env-file=.env server.js`,
    command: 'node --env-file=.env'
  },
  {
    name: 'uuid',
    minNode: '15.6.0',
    description: 'Native crypto.randomUUID()',
    diff: `// Before:
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();

// After:
import { randomUUID } from 'node:crypto';
const id = randomUUID();`,
    replacement: "import { randomUUID } from 'node:crypto';"
  },
  {
    name: 'rimraf',
    minNode: '14.14.0',
    description: 'Native fs.rmSync(path, { recursive: true, force: true })',
    diff: `// Before:
import rimraf from 'rimraf';
rimraf.sync('./dist');

// After:
import { rmSync } from 'node:fs';
rmSync('./dist', { recursive: true, force: true });`,
    replacement: "import { rmSync } from 'node:fs';"
  },
  {
    name: 'mkdirp',
    minNode: '10.12.0',
    description: 'Native fs.mkdirSync(path, { recursive: true })',
    diff: `// Before:
import mkdirp from 'mkdirp';
mkdirp.sync('./dist/cache');

// After:
import { mkdirSync } from 'node:fs';
mkdirSync('./dist/cache', { recursive: true });`,
    replacement: "import { mkdirSync } from 'node:fs';"
  },
  {
    name: 'nodemon',
    minNode: '18.11.0',
    description: 'Native file watcher node --watch',
    diff: `// Before (package.json scripts):
"dev": "nodemon server.js"

// After:
"dev": "node --watch server.js"`,
    command: 'node --watch'
  },
  {
    name: 'axios',
    minNode: '18.0.0',
    description: 'Native global fetch()',
    diff: `// Before:
import axios from 'axios';
const res = await axios.get('https://api.example.com/data');
const data = res.data;

// After:
const res = await fetch('https://api.example.com/data');
const data = await res.json();`,
    replacement: 'fetch(url, options)'
  },
  {
    name: 'node-fetch',
    minNode: '18.0.0',
    description: 'Native global fetch()',
    diff: `// Before:
import fetch from 'node-fetch';
const res = await fetch('https://api.example.com/data');

// After:
const res = await fetch('https://api.example.com/data');`,
    replacement: 'fetch(url, options)'
  },
  {
    name: 'form-data',
    minNode: '18.0.0',
    description: 'Native global FormData',
    diff: `// Before:
import FormData from 'form-data';
const form = new FormData();
form.append('field', 'value');

// After (native global, zero imports):
const form = new FormData();
form.append('field', 'value');`,
    replacement: 'new FormData()'
  },
  {
    name: 'cross-fetch',
    minNode: '18.0.0',
    description: 'Native global fetch()',
    diff: `// Before:
import fetch from 'cross-fetch';
const res = await fetch('https://api.example.com/data');

// After (native global, zero imports):
const res = await fetch('https://api.example.com/data');`,
    replacement: 'fetch(url, options)'
  },
  {
    name: 'isomorphic-fetch',
    minNode: '18.0.0',
    description: 'Native global fetch()',
    diff: `// Before:
import 'isomorphic-fetch';
const res = await fetch('https://api.example.com/data');

// After (native global, zero imports):
const res = await fetch('https://api.example.com/data');`,
    replacement: 'fetch(url, options)'
  },
  {
    name: 'whatwg-fetch',
    minNode: '18.0.0',
    description: 'Native global fetch()',
    diff: `// Before:
import 'whatwg-fetch';
const res = await fetch('https://api.example.com/data');

// After (native global, zero imports):
const res = await fetch('https://api.example.com/data');`,
    replacement: 'fetch(url, options)'
  },
  {
    name: 'glob',
    minNode: '22.0.0',
    description: 'Native fs.globSync(pattern)',
    diff: `// Before:
import { globSync } from 'glob';
const files = globSync('**/*.js');

// After:
import { globSync } from 'node:fs';
const files = globSync('**/*.js');`,
    replacement: "import { globSync } from 'node:fs';"
  },
  {
    name: 'querystring',
    minNode: '10.0.0',
    description: 'Native URLSearchParams / URL',
    diff: `// Before:
import querystring from 'querystring';
const q = querystring.stringify({ foo: 'bar' });

// After:
const q = new URLSearchParams({ foo: 'bar' }).toString();`,
    replacement: 'new URLSearchParams()'
  },
  {
    name: 'strip-ansi',
    minNode: '20.13.0',
    description: 'Native util.stripVTControlCharacters()',
    diff: `// Before:
import stripAnsi from 'strip-ansi';
const clean = stripAnsi(text);

// After:
import { stripVTControlCharacters } from 'node:util';
const clean = stripVTControlCharacters(text);`,
    replacement: "import { stripVTControlCharacters } from 'node:util';"
  },
  {
    name: 'array-flatten',
    minNode: '11.0.0',
    description: 'Native Array.prototype.flat(Infinity)',
    diff: `// Before:
import flatten from 'array-flatten';
const flat = flatten(items);

// After (native Array method):
const flat = items.flat(Infinity);`,
    replacement: 'items.flat(Infinity)'
  },
  {
    name: 'minimist',
    minNode: '18.3.0',
    description: 'Native util.parseArgs()',
    diff: `// Before:
import minimist from 'minimist';
const args = minimist(process.argv.slice(2));

// After:
import { parseArgs } from 'node:util';
const { values, positionals } = parseArgs({ args: process.argv.slice(2) });`,
    replacement: "import { parseArgs } from 'node:util';"
  },
  {
    name: 'yargs-parser',
    minNode: '18.3.0',
    description: 'Native util.parseArgs()',
    diff: `// Before:
import yargsParser from 'yargs-parser';
const flags = yargsParser(process.argv.slice(2));

// After:
import { parseArgs } from 'node:util';
const { values } = parseArgs({ args: process.argv.slice(2) });`,
    replacement: "import { parseArgs } from 'node:util';"
  },
  {
    name: 'is-promise',
    minNode: '0.12.0',
    description: 'Native Promise check: Boolean(val && typeof val.then === "function")',
    diff: `// Before:
import isPromise from 'is-promise';
if (isPromise(val)) { ... }

// After (zero dependencies):
if (Boolean(val && typeof val.then === 'function')) { ... }`,
    replacement: "Boolean(val && typeof val.then === 'function')"
  },
  {
    name: 'left-pad',
    minNode: '8.0.0',
    description: 'Native String.prototype.padStart()',
    diff: `// Before:
import leftPad from 'left-pad';
const res = leftPad(str, 10, '0');

// After (native String method):
const res = String(str).padStart(10, '0');`,
    replacement: "String(str).padStart(10, '0')"
  },
  {
    name: 'pad-left',
    minNode: '8.0.0',
    description: 'Native String.prototype.padStart()',
    diff: `// Before:
import padLeft from 'pad-left';
const res = padLeft(str, 10, '0');

// After (native String method):
const res = String(str).padStart(10, '0');`,
    replacement: "String(str).padStart(10, '0')"
  },
  {
    name: 'is-number',
    minNode: '0.10.0',
    description: 'Native Number.isFinite() check',
    diff: `// Before:
import isNumber from 'is-number';
if (isNumber(val)) { ... }

// After:
if (typeof val === 'number' && Number.isFinite(val)) { ... }`,
    replacement: "typeof val === 'number' && Number.isFinite(val)"
  },
  {
    name: 'is-odd',
    minNode: '0.10.0',
    description: 'Native modulo operator % 2 !== 0',
    diff: `// Before:
import isOdd from 'is-odd';
if (isOdd(n)) { ... }

// After:
if (n % 2 !== 0) { ... }`,
    replacement: 'n % 2 !== 0'
  },
  {
    name: 'is-even',
    minNode: '0.10.0',
    description: 'Native modulo operator % 2 === 0',
    diff: `// Before:
import isEven from 'is-even';
if (isEven(n)) { ... }

// After:
if (n % 2 === 0) { ... }`,
    replacement: 'n % 2 === 0'
  },
  {
    name: 'path',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:path',
    diff: `// Before:
import path from 'path';

// After (uninstall npm package, import native core):
import path from 'node:path';`,
    replacement: "import path from 'node:path';"
  },
  {
    name: 'crypto',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:crypto',
    diff: `// Before:
import crypto from 'crypto';

// After (uninstall npm package, import native core):
import crypto from 'node:crypto';`,
    replacement: "import crypto from 'node:crypto';"
  },
  {
    name: 'url',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:url',
    diff: `// Before:
import url from 'url';

// After (uninstall npm package, import native core):
import url from 'node:url';`,
    replacement: "import url from 'node:url';"
  },
  {
    name: 'buffer',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:buffer',
    diff: `// Before:
import { Buffer } from 'buffer';

// After (uninstall npm package, import native core):
import { Buffer } from 'node:buffer';`,
    replacement: "import { Buffer } from 'node:buffer';"
  },
  {
    name: 'os',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:os',
    diff: `// Before:
import os from 'os';

// After (uninstall npm package, import native core):
import os from 'node:os';`,
    replacement: "import os from 'node:os';"
  },
  {
    name: 'fs',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:fs',
    diff: `// Before:
import fs from 'fs';

// After (uninstall npm package, import native core):
import fs from 'node:fs';`,
    replacement: "import fs from 'node:fs';"
  },
  {
    name: 'util',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:util',
    diff: `// Before:
import util from 'util';

// After (uninstall npm package, import native core):
import util from 'node:util';`,
    replacement: "import util from 'node:util';"
  },
  {
    name: 'events',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:events',
    diff: `// Before:
import { EventEmitter } from 'events';

// After (uninstall npm package, import native core):
import { EventEmitter } from 'node:events';`,
    replacement: "import { EventEmitter } from 'node:events';"
  },
  {
    name: 'string_decoder',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:string_decoder',
    diff: `// Before:
import { StringDecoder } from 'string_decoder';

// After (uninstall npm package, import native core):
import { StringDecoder } from 'node:string_decoder';`,
    replacement: "import { StringDecoder } from 'node:string_decoder';"
  },
  {
    name: 'timers',
    minNode: '0.10.0',
    description: 'Redundant npm package shadowing Node standard library node:timers',
    diff: `// Before:
import timers from 'timers';

// After (uninstall npm package, import native core):
import timers from 'node:timers';`,
    replacement: "import timers from 'node:timers';"
  },
  {
    name: 'chalk',
    minNode: '22.0.0',
    description: 'Native node:util styleText()',
    diff: `// Before:
import chalk from 'chalk';
console.log(chalk.red.bold('Error'));

// After (Node 22+):
import { styleText } from 'node:util';
console.log(styleText(['red', 'bold'], 'Error'));`,
    replacement: "import { styleText } from 'node:util';"
  },
  {
    name: 'deep-equal',
    minNode: '12.0.0',
    description: 'Native node:assert assert.deepStrictEqual()',
    diff: `// Before:
import deepEqual from 'deep-equal';
const isEqual = deepEqual(objA, objB);

// After:
import assert from 'node:assert';
assert.deepStrictEqual(objA, objB);`,
    replacement: "import assert from 'node:assert';"
  },
  {
    name: 'delay',
    minNode: '15.0.0',
    description: 'Native node:timers/promises setTimeout()',
    diff: `// Before:
import delay from 'delay';
await delay(1000);

// After:
import { setTimeout } from 'node:timers/promises';
await setTimeout(1000);`,
    replacement: "import { setTimeout } from 'node:timers/promises';"
  },
  {
    name: 'sleep-promise',
    minNode: '15.0.0',
    description: 'Native node:timers/promises setTimeout()',
    diff: `// Before:
import sleep from 'sleep-promise';
await sleep(1000);

// After:
import { setTimeout } from 'node:timers/promises';
await setTimeout(1000);`,
    replacement: "import { setTimeout } from 'node:timers/promises';"
  },
  {
    name: 'crypto-js',
    minNode: '16.0.0',
    description: 'Native node:crypto or Web Crypto API',
    diff: `// Before:
import CryptoJS from 'crypto-js';
const hash = CryptoJS.SHA256(data).toString();

// After:
import { createHash } from 'node:crypto';
const hash = createHash('sha256').update(data).digest('hex');`,
    replacement: "import { createHash } from 'node:crypto';"
  },
  {
    name: 'moment',
    minNode: '14.0.0',
    description: 'Native Intl.DateTimeFormat and Date API',
    diff: `// Before:
import moment from 'moment';
const formatted = moment().format('LL');

// After (built-in Intl):
const formatted = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());`,
    replacement: "new Intl.DateTimeFormat('en-US', options).format(date)"
  },
];
