# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- `--fix` and `--fix --force` to automatically remove confirmed 0-import unused packages across npm, pnpm, yarn, and bun.
- Generation of `depshred-migration.md` summary reports detailing recovered disk space.
- Lockfile parsing (`package-lock.json`, `pnpm-lock.yaml`) to detect phantom dependencies.
- Official GitHub Action (`depshred/action`) for automated pull request checks.
- AST-powered automated code import rewriting for native replacements.

## [1.1.0] - 2026-10-12

### Added
- Expanded Native Node.js Standard Library replacement catalog in `src/rules/native-rules.js`:
  - Web standards: `form-data` -> native global `FormData`, `cross-fetch` / `isomorphic-fetch` / `whatwg-fetch` -> native global `fetch()`.
  - Node standard library utilities: `strip-ansi` -> `util.stripVTControlCharacters()`, `array-flatten` -> `Array.prototype.flat()`, `minimist` / `yargs-parser` -> `util.parseArgs()`.
  - Language micro-packages: `is-promise`, `left-pad`, `pad-left`, `is-number`, `is-odd`, `is-even` -> native JavaScript operators.
  - Core module shadow detection: Flags redundant npm packages shadowing Node core (`path`, `crypto`, `url`, `buffer`, `os`, `fs`, `util`, `events`, `string_decoder`, `timers`).
- Expanded Modern Lightweight Alternatives catalog in `src/rules/alt-rules.js`:
  - `request` (deprecated) -> native `fetch` or `ky`.
  - `superagent` -> native `fetch` or `ky`.
  - `bluebird` -> native `Promise` and async/await.
  - `yargs` -> `node:util parseArgs` or `citty`.
  - `ora` -> `yocto-spinner`.
  - `qs` -> native `URLSearchParams`.
- Comprehensive automated test coverage for web standards, version boundary enforcement, and core shadow detection (11 automated test suites passing).
- Updated agent skill rules across Copilot, Cursor, Windsurf, Claude Code, Cline, and Antigravity.
- Expanded transparent replacements documentation in `README.md`.

## [1.0.2] - 2026-10-11

### Added
- Smart compiler and bundler infrastructure detection in `src/locator.js` (recognizes `@babel/core`, `@babel/runtime`, `babel-plugin-*`, `@babel/plugin-*`, `babel-preset-*`, and `babel-plugin-react-compiler`).
- Bundler plugin recognition (`@rolldown/plugin-*`, `@vitejs/plugin-*`, `vite-plugin-*`, `@rollup/plugin-*`, `*-webpack-plugin`).
- CSS compiler toolchain recognition (`postcss`, `postcss-*`, `tailwindcss`, `autoprefixer`).
- Linter and formatter plugin recognition (`eslint-config-*`, `eslint-plugin-*`, `@eslint/*`, `prettier-plugin-*`).
- Ambient TypeScript declarations (`@types/*`) automatic recognition.
- `depshred` self-ignore rule so the tool never flags itself as an unused dependency.
- Expanded modern lightweight alternatives catalog in `src/rules/alt-rules.js` (`zod` -> `valibot`/`arktype`, `classnames` -> `clsx`, `deep-equal` -> `fast-deep-equal`).
- Actionable inspector screen in `src/interactive.js`: Before & After diffs for native replacements, lighter alternatives advice, and file reference snippets.
- Transparent limitations and supported replacements catalog in `README.md`.
- Automated test coverage for Babel compiler toolchains and Zod alternative rule (9 total passing tests).

### Fixed
- Fixed CLI help example path to use `./path/to/your-project` instead of confusing `./packages/api`.
- Fixed User-Agent header in registry client to match current version.

## [1.0.1] - 2026-10-11

### Fixed
- Fixed `bin` path format in `package.json` (`bin/depshred.js` without leading `./`) to prevent npm from stripping the executable script.
- Normalized `repository.url` in `package.json` with standard `git+https` protocol.
- Updated `README.md` image links to GitHub raw URLs so images render properly on `npmjs.com`.

## [1.0.0] - 2026-10-09

### Added
- Universal dependency auditing scanning 100% of declared packages in `package.json`.
- Native Node.js standard library replacement detection for Node 18, 20, and 22+ built-ins (`dotenv`, `uuid`, `rimraf`, `mkdirp`, `nodemon`, `axios`, `glob`, `querystring`).
- Unused dependency detection mapping 0-import packages with copy-ready `npm uninstall` commands.
- `package.json` script command scanning to prevent false-positive unused warnings on CLI tools.
- Smart dormancy checking (>3 years) distinguishing self-contained zero-dependency modules from rotting software.
- Live npm registry metadata harvesting (unpacked size, transitive dependency counts, dormancy, deprecations).
- Zero-clutter metadata caching in OS temporary directory (`os.tmpdir()`) with 24-hour TTL.
- CLI execution modes: default interactive terminal explorer, `--check` CI exit code mode, `--strict`, and structured `--json` output.
- `--init-skill` command to automatically install agent vetting skills into Cursor, Copilot, Windsurf, Claude Code, Cline, and universal workspaces.
- Multi-IDE pre-flight vetting skill catalog in `skills/` and root `SKILLS.md`.
- Near-zero external dependencies architecture using Node.js standard library APIs and `picocolors`.