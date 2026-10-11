# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Interactive prompt to automatically execute `npm uninstall <pkg>` for confirmed removals.
- Generation of `depshred-migration.md` summary reports.
- Lockfile parsing (`package-lock.json`, `pnpm-lock.yaml`) to detect phantom dependencies.
- Official GitHub Action (`depshred/action`) for automated pull request checks.
- AST-powered automated code import rewriting.

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