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
  }
];
