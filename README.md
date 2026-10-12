<p align="center">
  <img src="https://raw.githubusercontent.com/gozajpeg/depshred/master/assets/depshred.webp" width="200" alt="depshred logo">
</p>

<h1 align="center">depshred</h1>

<p align="center">
  <em>Clean up your node_modules. Stop installing stuff Node already has.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/run_with-npx_depshred-111111?style=flat-square" alt="Run with npx">
  <img src="https://img.shields.io/badge/node.js-18%2B_%7C_20%2B_%7C_22%2B-111111?style=flat-square" alt="Node Support">
  <img src="https://img.shields.io/badge/version-2.0.0-111111?style=flat-square" alt="version 2.0.0">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

---

Ever look at your `node_modules` folder and wonder why it takes up half your hard drive?

When you follow tutorials or ask AI to write code, it is super easy to end up with 30 different packages installed for things modern Node can already do by itself. Stuff like `dotenv`, `uuid`, or `rimraf` do not need to be in your project anymore. Node already knows how to do all of that.

`depshred` looks through your project, finds packages you do not actually need, and shows you how to swap them for simple code that comes with Node.

---

## Quick start

You do not even need to install anything first. Just open your terminal inside your project folder and run:

```bash
npx depshred
```

If your project lives in another folder, just tell it where:

```bash
npx depshred ./path/to/your-project
```

Using pnpm or bun instead of npm? That works too:

```bash
pnpm dlx depshred
bunx depshred
```

---

## What it looks like

Here is what you see when you run it in your terminal:

<p align="center">
  <img src="https://raw.githubusercontent.com/gozajpeg/depshred/master/assets/view01.webp" width="100%" alt="depshred terminal interface">
</p>

You get an easy list you can move through with your arrow keys:

```text
+--------------------------------------------------------------------------+
| depshred v2.0.0 (Node v22.0.0)                                          |
| Target: ./my-project                                                     |
+--------------------------------------------------------------------------+
| Total Scanned: 24 dependencies                                           |
|                                                                          |
| [CRITICAL] 2 packages have native Node.js replacements (saves ~182 KB)   |
| [UNUSED]   1 package has 0 imports (run: npm uninstall rimraf)           |
| [WARN]     1 package is dormant >3y (0 sub-deps, self-contained)         |
| [OK]       20 packages are lean and actively maintained                  |
+--------------------------------------------------------------------------+

Select a dependency to inspect (Use arrow keys, Enter to inspect):
  > [CRITICAL] dotenv    Native Node.js built-in available (saves ~72 KB)
    [CRITICAL] uuid      Native Node.js built-in available (saves ~110 KB)
    [UNUSED]   rimraf    0 imports found in project source code
    [WARN]     ms        Dormant >3 years | 0 sub-dependencies (self-contained)
    [OK]       fastify   Active, schema-compiled and lean
```

---

## What it checks for

When you run `depshred`, it checks three main things:

1. **Stuff Node already has built in**
Do you really need `dotenv` when Node can load `.env` files on its own? Do you need `uuid` when Node has `crypto.randomUUID()`? `depshred` finds every file and exact line number where you use these, and shows you the quick built-in way to replace them.

2. **Packages you installed but never use**
Ever ran `npm install` for a test or a guide, forgot about it, and left it sitting in your `package.json`? `depshred` scans your whole project. If you never imported it anywhere, it tells you straight up: `npm uninstall <package>`.

3. **Old or abandoned packages**
It checks npm to see how big each package is and whether anyone has touched it in the last 3 years. If a package is small, has zero other packages inside it, and just works, `depshred` lets you know so you do not have to worry.

```text
                    Your package.json
                            |
         +------------------+------------------+
         |                  |                  |
         v                  v                  v
 1. Already in Node?   2. Used in code?   3. npm check
 (dotenv, uuid, etc.)  (0 imports found)  (file size, age)
         |                  |                  |
         v                  v                  v
 Use Node built-ins      Safe to delete    Good to know
 (saves disk space)     (npm uninstall)   (see how big it is)
```


---

## Scanner Scope and Boundaries

To remain fast, zero-dependency, and predictable, `depshred` defines exact boundaries for its static analysis scanner:

### What is Scanned
- **File Extensions:** `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.jsx`, `.vue`, and `.svelte`.
- **Import Syntax (Single-line & Multi-line):**
  - Standard ESM: `import 'pkg'`, `import { foo } from 'pkg'`, `import * as foo from 'pkg'`.
  - TypeScript Type Imports: `import type { Foo } from 'pkg'`, `import { type Foo, bar } from 'pkg'`, and `export type { Foo } from 'pkg'`.
  - CommonJS: `require('pkg')` and multi-line `require('pkg')`.
  - Dynamic Imports: `import('pkg')` and `await import('pkg')`.
- **Comment Stripping:** Single-line (`//`) and multi-line (`/* ... */`) comments are stripped before analysis, ensuring commented-out code does not trigger false imports while preserving accurate line numbers.
- **Single-File Components (.vue & .svelte):** Only content within `<script>` and `<script setup>` tags is analyzed. Template tags and `<style>` preprocessors are out of scope.
- **Implicit Toolchain References:**
  - CLI binaries referenced in `package.json` scripts (e.g. `"build": "rimraf dist"`).
  - Root config files (`vite.config.*`, `tsconfig.json`, `postcss.config.*`, `.babelrc`, `eslint.config.*`).
  - Known toolchain conventions (`@babel/*`, `babel-plugin-*`, `@vitejs/plugin-*`, `@types/*`, `eslint-plugin-*`, etc.).

### What is Not Handled
- **Computed Dynamic Imports:** Computed specifiers such as `require(computeName())` cannot be resolved statically. Ignore these using `--ignore <pkg>` or in `package.json`.
- **Complex Monorepo Loaders:** For deeply nested monorepos with custom loaders, ingest a Knip report via `--from-knip`.

---

## What packages can depshred replace?

To be completely honest: no tool can replace every single package in the world. Node does not have a built-in 3D engine to replace `three.js` or a built-in database to replace `pg`.

Instead, `depshred` targets the **most common sources of accidental bloat**: legacy packages that modern Node already includes for free, and heavy monolithic libraries with modern lightweight replacements.

### 1. Modern Node.js built-ins (Zero packages needed)

| Legacy Package | Built-in Node Feature | Supported in | What replaces it |
| :--- | :--- | :--- | :--- |
| **`dotenv`** | `--env-file` | Node 20.6+ | `node --env-file=.env app.js` |
| **`uuid`** | `crypto.randomUUID()` | Node 14.17+ / 16.7+ | `crypto.randomUUID()` |
| **`rimraf`** | `fs.rmSync()` / `fs.rm()` | Node 14.14+ | `fs.rmSync(path, { recursive: true, force: true })` |
| **`mkdirp`** | `fs.mkdirSync()` / `fs.mkdir()` | Node 10.12+ | `fs.mkdirSync(path, { recursive: true })` |
| **`nodemon`** | `node --watch` | Node 18.11+ | `node --watch app.js` |
| **`axios`** | `fetch()` | Node 18+ | Native `fetch` and `AbortController` |
| **`node-fetch`** | `fetch()` | Node 18+ | Native `fetch` and `AbortController` |
| **`form-data`** | `FormData` | Node 18+ | Native global `FormData` (zero imports) |
| **`cross-fetch`** / **`isomorphic-fetch`** | `fetch()` | Node 18+ | Native global `fetch()` (zero imports) |
| **`strip-ansi`** | `util.stripVTControlCharacters()` | Node 20.13+ / 22+ | Native `node:util` ANSI stripping |
| **`array-flatten`** | `Array.prototype.flat()` | Node 11+ | Built-in `items.flat(Infinity)` |
| **`minimist`** / **`yargs-parser`** | `util.parseArgs()` | Node 18.3+ | Built-in CLI arg parser in `node:util` |
| **`glob`** | `fs.glob()` | Node 22+ | Native file matching in `node:fs` |
| **`querystring`** | `URLSearchParams` | Node 10+ | Built-in `URLSearchParams` |
| **`is-promise`** / **`left-pad`** / **`is-odd`** | Native JavaScript | Node 8+ | Built-in language operators and methods |
| **`path`**, **`crypto`**, **`fs`**, **`os`**, **`buffer`** | `node:<module>` | Node 14.18+ / 16+ | Core module shadows (uninstall redundant npm packages) |

### 2. Lightweight modern alternatives

| Heavy Package | Suggested Alternative | What you save |
| :--- | :--- | :--- |
| **`zod`** | `valibot` or `arktype` | Saves ~5.5 MB unpacked (~90% bundle size reduction) |
| **`moment`** | `dayjs` or native `Intl` | Saves ~4 MB unpacked |
| **`lodash`** | `es-toolkit` or modern JS | Saves ~1.5 MB unpacked |
| **`request`** | Native `fetch` or `ky` | Saves ~5 MB unpacked (deprecated package) |
| **`superagent`** | Native `fetch` or `ky` | Saves ~1.8 MB unpacked |
| **`bluebird`** | Native `Promise` / async-await | Saves ~1.5 MB unpacked (native V8 runtime) |
| **`yargs`** | `node:util parseArgs` or `citty` | Saves ~2.5 MB unpacked |
| **`chalk`** | `picocolors` | Saves ~100 KB and drops dependency chain |
| **`classnames`** | `clsx` | Drop-in API, faster, zero dependencies |
| **`bcrypt`** | `bcryptjs` or native `crypto` | Removes heavy C++ `node-gyp` build tools |
| **`deep-equal`** | `fast-deep-equal` | Sub-1KB, faster comparisons |
| **`ora`** | `yocto-spinner` | Saves ~200 KB unpacked, zero sub-dependencies |
| **`qs`** | Native `URLSearchParams` | Saves ~200 KB unpacked for standard flat queries |

> **Suggestions are optional, not requirements:**  
> If `depshred` flags a package like `zod` or `yargs` and suggests an alternative, you do not have to change it. If your project relies on specific ecosystem plugins, advanced features, or team habits that your current library provides, keep using it. Suggestions are meant to highlight lightweight options when building new modules or trimming bundles. You can permanently silence any warning with `--ignore <pkg>` or by adding it to `"depshred": { "ignore": [...] }` in your `package.json`.
>
> *Everything else in your project is still scanned for 0-import unused packages, heavy sizes (>5MB), and unmaintained/abandoned code (>3 years old).*

---

## Extra options

Need to run it inside a script or change how it works? Here are the flags you can use:

| Flag | What it does |
| :--- | :--- |
| `--check` | Checks your project and stops with an error if it finds bad or useless packages. Great for GitHub Actions. |
| `--strict` | Like `--check`, but also stops on small warnings. |
| `--json` | Prints results as JSON so you can read them with code. |
| `--no-interactive` | Skips the arrow-key menu and just prints a plain table. |
| `--path <folder>` | Checks a different folder instead of where you are right now. |
| `--dormant-years <num>` | How many years without updates before calling a package old (defaults to 3). |
| `--ignore <names>` | Comma-separated names of packages you want to skip. |
| `--init-skill [app]` | Adds instructions to your AI editor so it stops installing packages you do not need. |
| `--help`, `-h` | Shows all available flags. |
| `--version`, `-v` | Shows the version number. |

---

## Teach your AI editor to stop installing junk

If you use AI coding tools like Cursor, Claude, Windsurf, or GitHub Copilot, you have probably seen them run `npm install` for every single little thing. Most of the time, Node already has what they are trying to download.

You can teach your AI helper to check first before installing:

```bash
# Pick your editor from a menu:
npx depshred --init-skill

# Or pick your editor directly:
npx depshred --init-skill cursor       # For Cursor (.cursor/rules)
npx depshred --init-skill copilot      # For GitHub Copilot (.github)
npx depshred --init-skill windsurf     # For Windsurf (.windsurf/rules)
npx depshred --init-skill claude       # For Claude Code (CLAUDE.md)
npx depshred --init-skill cline        # For Cline (.clinerules)
npx depshred --init-skill antigravity  # For Antigravity (.agents/skills)
npx depshred --init-skill agents       # For general agents (AGENTS.md)
npx depshred --init-skill all          # Sets up all of them at once
```

Want to see all the skill files and how they work? Check out [SKILLS.md](SKILLS.md).

---

## Save your settings

If there is a package you want `depshred` to leave alone, you can save your preferences right inside your `package.json`:

```json
{
  "depshred": {
    "ignore": ["fast-deep-equal"],
    "dormantYears": 4
  }
}
```

---

## What projects work with it?

Pretty much any modern Node.js project:

- **Any framework:** Express, Fastify, Next.js, NestJS, Koa, or plain Node scripts.
- **Any module style:** Both `import` (ES Modules) and `require` (CommonJS).
- **JavaScript and TypeScript:** `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`.
- **Projects with multiple folders:** Works with monorepos using the `--path` flag.

---

## Empirical Benchmarks

False-positive rates and agent decision benchmarks are verified against real open-source repositories and held-out test prompts. See [BENCHMARK.md](file:///BENCHMARK.md) for complete methodology, corpus metadata, and run scorecards.

---

## Questions you might have

**What if I prefer the package that depshred flagged?**  
Keep it. `depshred` gives advice based on disk size and modern Node features, but you know your project best. If a flagged package (such as `zod`, `yargs`, or `moment`) is the right choice for your architecture or has integrations you need, you can safely ignore the recommendation or permanently allowlist it in your `package.json` ignore settings.

**Does it change my code automatically?**  
No. `depshred` never touches your code behind your back. It shows you the file, the line number, and the built-in Node replacement. You decide what to change and when.

**Does it need a database or send my code to some server?**  
No. Everything runs right on your computer. It only talks to the public npm website to check package sizes and update dates. It saves that info in your computer's temporary folder for a day so it stays fast.

**What if an old package works fine and does not need updates?**  
Not every old package is broken. Some small tools are simply finished and do not need changes. `depshred` checks if the package has zero sub-packages. If it is small and self-contained, it gives you a soft heads-up, not a red error. You can also add it to your ignore list.

**Does it work with Python or Go?**  
No, this is built only for Node.js and npm projects.

---

## License

[MIT](LICENSE).