# depshred: AI Coding Agent Operating Instructions

This file instructs AI coding agents (Claude, Cursor, Copilot, Antigravity, OpenHands, Devin) on how to work on and maintain the `depshred` codebase.

---

## 1. Architecture & Design Principles

* **Pure Node.js ES Modules:** `"type": "module"`. No CommonJS, no Babel, no TypeScript compilation step.
* **Zero Build Step:** Code in `src/` runs directly in Node.js.
* **Near-Zero External Dependencies:** Only `picocolors` is allowed in `dependencies`. Never add external dependencies for tasks that the Node.js standard library handles.
* **Standard Library First:**
  * CLI options: `node:util.parseArgs`
  * File walking & reading: `node:fs` / `node:fs/promises`
  * Path resolution: `node:path`
  * OS temporary caching: `node:os` (`tmpdir()`)
  * UUID & hashing: `node:crypto`
  * Networking: Native global `fetch()`
  * Testing: Native `node:test` (`node --test`)
* **Zero Emojis:** Strictly zero emojis across all code, terminal output, and documentation files.

---

## 2. Essential Commands

* **Run CLI locally:** `node ./bin/depshred.js`
* **Run Self-Audit:** `node ./bin/depshred.js --check`
* **Run Test Suite:** `npm test` or `node --test test/*.test.js`
* **Test Fixtures:** `node ./bin/depshred.js ./test/fixtures/legacy-app --check`

---

## 3. Mandatory Pre-Flight Dependency Vetting Order

When asked to add functionality to this or any Node.js project, NEVER blindly run `npm install <package>`. Follow this 4-step order:

### Step 0: The Native Standard Library Check
Before reaching for npm, verify if modern Node.js already includes this natively:
- `dotenv` -> Native CLI flag `node --env-file=.env` (Node 20.6.0+)
- `uuid` -> Native `crypto.randomUUID()` (Node 15.6.0+)
- `rimraf` -> Native `fs.rmSync(path, { recursive: true, force: true })` (Node 14.14.0+)
- `mkdirp` -> Native `fs.mkdirSync(path, { recursive: true })` (Node 10.12.0+)
- `nodemon` -> Native file watcher `node --watch server.js` (Node 18.11.0+)
- `axios` / `node-fetch` -> Native global `fetch()` (Node 18.0.0+)
- `glob` -> Native `fs.globSync(pattern)` (Node 22.0.0+)
- `querystring` -> Native `URLSearchParams` / `new URL()` (Node 10.0.0+)

### Step 1: Existing Codebase Check
Check `package.json` and internal utilities in `src/` before adding any new package.

### Step 2: Vetting New Dependencies
- Avoid packages with no updates in >3 years unless confirmed zero-dependency, feature-complete modules.
- Prefer lightweight alternatives (`picocolors` over `chalk`, `dayjs` over `moment`).

### Step 3: Post-Change Verification
- Run tests: `npm test`.
- Verify clean audit: `node ./bin/depshred.js --check`.
